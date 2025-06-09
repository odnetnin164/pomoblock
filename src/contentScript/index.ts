// src/contentScript/index.ts
import { ExtensionSettings } from '@shared/types';
import { getSettings, getBlockedWebsites, getWhitelistedPaths, onStorageChanged } from '@shared/storage';
import { logger } from '@shared/logger';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { shouldBlockBasedOnWorkHours } from '@shared/workHoursUtils';
import { BlockingEngine } from './blockingEngine';
import { BlockedPageUI } from './ui/blockedPage';
import { FloatingTimer } from './ui/floatingTimer';

class ContentScriptManager {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private blockingEngine: BlockingEngine;
  private blockedPageUI: BlockedPageUI;
  private floatingTimer: FloatingTimer;
  private currentUrl: string = '';
  private urlCheckInterval: number | null = null;
  private isInitialized: boolean = false;
  private isTimerBlocking: boolean = false;

  constructor() {
    this.blockingEngine = new BlockingEngine();
    this.blockedPageUI = new BlockedPageUI(this.settings);
    this.floatingTimer = new FloatingTimer();
    this.currentUrl = window.location.href;
    
    this.init();
  }

  /**
   * Initialize the content script
   */
  private async init(): Promise<void> {
    if (this.isInitialized) {
      logger.log('Content script already initialized, skipping');
      return;
    }

    logger.log('ContentScript initializing');
    logger.log('Current URL', window.location.href);
    logger.log('Document ready state', document.readyState);

    // Load settings and site lists
    await this.loadConfiguration();

    // Initialize floating timer
    await this.floatingTimer.initialize();

    // Check timer blocking status
    await this.checkTimerBlockingStatus();

    // Set up storage change listener
    this.setupStorageListener();

    // Set up navigation detection
    this.setupNavigationDetection();

    // Set up timer message listener
    this.setupTimerMessageListener();

    // Check if current site should be blocked
    this.checkAndBlock();

    this.isInitialized = true;
    logger.log('ContentScript fully initialized');
  }

  /**
   * Load all configuration from storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      logger.log('Loading configuration from storage');

      // Load settings
      this.settings = await getSettings();
      logger.log('Loaded settings', this.settings);

      // Update logger debug state
      logger.setDebugEnabled(this.settings.debugEnabled);

      // Update UI with current settings
      this.blockedPageUI.updateSettings(this.settings);

      // If extension is disabled, don't continue
      if (!this.settings.extensionEnabled) {
        logger.log('Extension is disabled, cleaning up and exiting');
        this.blockedPageUI.removeBlockedPage();
        return;
      }

      // Load blocked websites
      const blockedWebsites = await getBlockedWebsites();
      logger.log('Loaded blocked websites', blockedWebsites);
      this.blockingEngine.updateBlockedSites(blockedWebsites);

      // Load whitelisted paths
      const whitelistedPaths = await getWhitelistedPaths();
      logger.log('Loaded whitelisted paths', whitelistedPaths);
      this.blockingEngine.updateWhitelistedPaths(whitelistedPaths);

    } catch (error) {
      logger.log('Error loading configuration', (error as Error).message);
    }
  }

  /**
   * Check current timer blocking status
   */
  private async checkTimerBlockingStatus(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'IS_TIMER_BLOCKING' });
      this.isTimerBlocking = response.blocking || false;
      logger.log('Timer blocking status:', this.isTimerBlocking);
    } catch (error) {
      logger.log('Error checking timer blocking status', (error as Error).message);
      this.isTimerBlocking = false;
    }
  }

  /**
   * Set up storage change listener
   */
  private setupStorageListener(): void {
    onStorageChanged((changes, areaName) => {
      if (areaName === 'sync') {
        logger.log('Storage changed', changes);

        // Handle blocked websites or whitelisted paths changes
        if (changes.blockedWebsitesArray || changes.whitelistedPathsArray) {
          logger.log('Blocked websites or whitelisted paths changed, reloading configuration');
          this.loadConfiguration().then(() => {
            // Re-check current page after configuration update
            this.checkAndBlock();
          });
          return;
        }

        // Handle work hours changes - reload full configuration if any work hours setting changed
        if (changes.workHoursEnabled !== undefined || 
            changes.workHoursStartTime !== undefined || 
            changes.workHoursEndTime !== undefined || 
            changes.workHoursDays !== undefined) {
          logger.log('Work hours settings changed, reloading configuration');
          this.loadConfiguration().then(() => {
            // Re-check current page after work hours update
            this.checkAndBlock();
          });
          return;
        }

        // Handle settings changes
        let settingsChanged = false;

        if (changes.blockMode) {
          this.settings.blockMode = changes.blockMode.newValue || 'block';
          settingsChanged = true;
        }

        if (changes.redirectUrl) {
          this.settings.redirectUrl = changes.redirectUrl.newValue || 'https://www.google.com';
          settingsChanged = true;
        }

        if (changes.redirectDelay !== undefined) {
          this.settings.redirectDelay = changes.redirectDelay.newValue !== undefined ? 
            changes.redirectDelay.newValue : 3;
          settingsChanged = true;
        }

        if (changes.extensionEnabled !== undefined) {
          this.settings.extensionEnabled = changes.extensionEnabled.newValue;
          if (!this.settings.extensionEnabled) {
            logger.log('Extension disabled, cleaning up');
            this.cleanup();
            return;
          }
          settingsChanged = true;
        }

        if (changes.debugEnabled !== undefined) {
          this.settings.debugEnabled = changes.debugEnabled.newValue;
          logger.setDebugEnabled(this.settings.debugEnabled);
          settingsChanged = true;
        }

        // Debug work hours changes
        if (this.settings.debugEnabled) {
          if (changes.workHoursEnabled !== undefined ||
              changes.workHoursStartTime !== undefined ||
              changes.workHoursEndTime !== undefined ||
              changes.workHoursDays !== undefined) {
            logger.log('Work hours storage change detected:', {
              workHoursEnabled: changes.workHoursEnabled,
              workHoursStartTime: changes.workHoursStartTime,
              workHoursEndTime: changes.workHoursEndTime,
              workHoursDays: changes.workHoursDays
            });
          }
        }

        if (settingsChanged) {
          this.blockedPageUI.updateSettings(this.settings);
          logger.log('Settings updated', this.settings);
          
          // Re-check blocking status with new settings
          this.checkAndBlock();
        }
      }
    });
  }

  /**
   * Set up navigation detection to catch URL changes
   */
  private setupNavigationDetection(): void {
    logger.log('Setting up navigation detection');

    // Method 1: Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', (event) => {
      logger.log('Navigation detected: popstate', event.state);
      this.handleNavigationChange();
    });

    // Method 2: Override pushState and replaceState to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      logger.log('Navigation detected: pushState');
      setTimeout(() => {
        (window as any).contentScriptManager?.handleNavigationChange();
      }, 100);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      logger.log('Navigation detected: replaceState');
      setTimeout(() => {
        (window as any).contentScriptManager?.handleNavigationChange();
      }, 100);
    };

    // Method 3: Listen for hashchange events
    window.addEventListener('hashchange', () => {
      logger.log('Navigation detected: hashchange');
      this.handleNavigationChange();
    });

    // Method 4: Listen for focus events (tab switching back)
    window.addEventListener('focus', () => {
      logger.log('Window focus detected, checking URL');
      this.handleNavigationChange();
    });

    // Method 5: Periodic URL checking as fallback (every 2 seconds)
    this.urlCheckInterval = window.setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        logger.log('Navigation detected: periodic check');
        this.handleNavigationChange();
      }
    }, 2000);

    // Method 6: Listen for DOM changes that might indicate navigation
    if (document.body) {
      this.setupMutationObserver();
    } else {
      // Wait for body to be available
      const bodyObserver = new MutationObserver((mutations, observer) => {
        if (document.body) {
          this.setupMutationObserver();
          observer.disconnect();
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }

    // Make this instance available globally for the overridden history methods
    (window as any).contentScriptManager = this;
  }

  /**
   * Set up timer message listener
   */
  private setupTimerMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TIMER_UPDATE' || message.type === 'TIMER_COMPLETE') {
        logger.log('Timer message received:', message.type);
        this.checkTimerBlockingStatus().then(() => {
          this.checkAndBlock();
        });
      }
    });
  }

  /**
   * Set up mutation observer to detect potential navigation changes
   */
  private setupMutationObserver(): void {
    let mutationTimeout: number | null = null;

    const observer = new MutationObserver((mutations) => {
      // Debounce mutation checks to avoid excessive calls
      if (mutationTimeout) {
        clearTimeout(mutationTimeout);
      }

      mutationTimeout = window.setTimeout(() => {
        // Check if URL changed during these mutations
        if (window.location.href !== this.currentUrl) {
          logger.log('Navigation detected: DOM mutation');
          this.handleNavigationChange();
        }
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: false // Only watch direct children to reduce noise
    });
  }

  /**
   * Handle navigation change
   */
  private handleNavigationChange(): void {
    const newUrl = window.location.href;
    
    if (newUrl !== this.currentUrl) {
      logger.log('URL changed', { from: this.currentUrl, to: newUrl });
      
      const wasBlocked = this.blockedPageUI.isPageBlocked();
      this.currentUrl = newUrl;
      
      // If we were showing a blocked page and now navigated away, remove it and clear any timers
      if (wasBlocked) {
        logger.log('Navigation detected: removing blocked page overlay and clearing timers');
        this.blockedPageUI.removeBlockedPage();
      }
      
      // Check timer status and then check if new page should be blocked
      this.checkTimerBlockingStatus().then(() => {
        setTimeout(() => {
          this.checkAndBlock();
        }, 250);
      });
    }
  }

  /**
   * Check if current site should be blocked and take action
   */
  private checkAndBlock(): void {
    logger.log('checkAndBlock called for URL:', window.location.href);

    // Don't block if extension is disabled
    if (!this.settings.extensionEnabled) {
      logger.log('Extension disabled, removing any existing block');
      this.blockedPageUI.removeBlockedPage();
      return;
    }

    // Don't block if already blocked (avoid duplicate overlays)
    if (this.blockedPageUI.isPageBlocked()) {
      logger.log('Page already blocked, skipping duplicate block');
      return;
    }

    // Check if timer is blocking sites
    if (this.isTimerBlocking) {
      logger.log('Timer is blocking sites - blocking current page');
      this.createTimerBlockPage();
      return;
    }

    // Check work hours - if work hours are enabled and we're outside work hours, don't block
    if (!shouldBlockBasedOnWorkHours(this.settings.workHours)) {
      logger.log('Outside work hours and no timer blocking, not blocking');
      this.blockedPageUI.removeBlockedPage();
      return;
    }

    // Check regular blocking rules
    if (this.blockingEngine.shouldBlockWebsite()) {
      logger.log('Site should be blocked by regular rules!');
      logger.log('Block mode is', this.settings.blockMode);

      if (this.settings.blockMode === 'redirect') {
        logger.log('Redirect mode - showing blocked page with countdown');
        this.blockedPageUI.createBlockedPage(true);
      } else {
        logger.log('Block mode - showing blocked page');
        this.blockedPageUI.createBlockedPage(false);
      }
    } else {
      logger.log('Site should NOT be blocked');
      // Make sure any existing block overlay is removed
      this.blockedPageUI.removeBlockedPage();
    }
  }

  /**
   * Create a blocked page specifically for timer blocking
   */
  private createTimerBlockPage(): void {
    logger.log('Creating timer block page');
    
    // Create a modified blocked page that indicates timer blocking
    const originalTitle = document.title;
    
    // Create timer-specific block overlay
    const overlay = document.createElement('div');
    overlay.id = 'pomoblock-timer-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%) !important;
      z-index: 2147483647 !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      color: white !important;
      overflow: auto !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;

    const currentTime = new Date().toLocaleString();
    const blockedURL = window.location.hostname + window.location.pathname;
    
    overlay.innerHTML = `
      <div style="text-align: center; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 60px 40px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); max-width: 700px; margin: 20px; color: white;">
        <div style="font-size: 80px; margin-bottom: 30px; animation: pulse 2s infinite;">🍅</div>
        <h1 style="font-size: 2.5em; margin-bottom: 20px; font-weight: 600; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">Pomodoro Work Session</h1>
        <div style="font-size: 1.2em; color: rgba(255, 255, 255, 0.9); margin-bottom: 30px; line-height: 1.6;">
          This website is blocked during your pomodoro work session.<br>
          Stay focused on your current task!
        </div>
        <div style="background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 15px; margin: 20px 0; color: #ffd93d; font-family: 'Courier New', monospace; font-size: 1.1em; word-break: break-all;">
          ${blockedURL}
        </div>
        
        <div style="background: rgba(255, 152, 0, 0.2); border: 2px solid rgba(255, 152, 0, 0.5); border-radius: 15px; padding: 25px; margin: 25px 0; color: white;">
          <h3 style="font-size: 1.3em; margin-bottom: 15px; color: #FFD93D;">🎯 Focus Mode Active</h3>
          <p style="margin-bottom: 15px; font-size: 1em; color: rgba(255, 255, 255, 0.9);">
            Your pomodoro timer is running. Use this time to focus on your current task.
          </p>
          <p style="font-size: 0.9em; color: #FFD93D; font-weight: 500; margin-top: 10px; padding: 8px 12px; background: rgba(255, 217, 61, 0.2); border-radius: 6px; border: 1px solid rgba(255, 217, 61, 0.3);">
            💡 This site will be accessible again when your work session ends or you stop the timer
          </p>
        </div>
        
        <div style="background: rgba(76, 175, 80, 0.1); border: 2px solid rgba(76, 175, 80, 0.3); border-radius: 15px; padding: 25px; margin: 25px 0; color: white;">
          <h4 style="font-size: 1.2em; margin-bottom: 15px; color: #4CAF50; font-weight: 600;">🔙 Navigation Options</h4>
          <p style="margin-bottom: 20px; color: rgba(255, 255, 255, 0.9); font-size: 0.95em; line-height: 1.5;">
            Press your browser's back button, press <kbd style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; padding: 3px 8px; font-size: 0.85em; font-family: 'Courier New', monospace; color: #FFD93D; font-weight: bold; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">Esc</kbd>, or use the buttons below:
          </p>
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-top: 20px;">
            <button onclick="history.back()" style="all: unset; background: #4CAF50; color: white; border: none; border-radius: 10px; padding: 14px 24px; font-size: 1em; font-weight: 700; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3); display: flex; align-items: center; gap: 8px; min-width: 140px; justify-content: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: 2px solid transparent; box-sizing: border-box;">
              <span style="font-size: 1.1em; font-weight: bold;">←</span>
              <span>Go Back</span>
            </button>
            <button onclick="window.location.href='https://www.google.com'" style="all: unset; background: #FF9800; color: white; border: none; border-radius: 10px; padding: 14px 24px; font-size: 1em; font-weight: 700; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3); display: flex; align-items: center; gap: 8px; min-width: 140px; justify-content: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: 2px solid transparent; box-sizing: border-box;">
              <span style="font-size: 1.1em; font-weight: bold;">🏠</span>
              <span>Home Page</span>
            </button>
          </div>
        </div>
        
        <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.9em; margin-top: 20px;">
          Blocked at: ${currentTime}
        </div>
      </div>
      
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        button:hover {
          transform: translateY(-2px) !important;
          filter: brightness(1.1) !important;
        }
      </style>
    `;

    // Handle escape key
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        history.back();
      }
    };
    document.addEventListener('keydown', handleKeyPress);

    // Prevent scrolling on background page
    document.body.style.overflow = 'hidden';

    // Add to page
    document.documentElement.appendChild(overlay);
    
    // Update page title
    document.title = '🍅 Timer Active - PomoBlock';
    
    logger.log('Timer block overlay created');
  }

  /**
   * Clean up event listeners and intervals
   */
  private cleanup(): void {
    logger.log('Cleaning up content script');

    // Clean up blocked page UI
    this.blockedPageUI.cleanup();

    // Clean up floating timer
    this.floatingTimer.destroy();

    // Remove timer-specific overlay if it exists
    const timerOverlay = document.getElementById('pomoblock-timer-overlay');
    if (timerOverlay) {
      timerOverlay.remove();
      document.body.style.overflow = '';
    }

    // Clear URL check interval
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    
    // Remove global reference
    delete (window as any).contentScriptManager;
    
    this.isInitialized = false;
    logger.log('Content script cleaned up');
  }
}

// Prevent multiple initializations
if (!(window as any).contentScriptManagerInitialized) {
  (window as any).contentScriptManagerInitialized = true;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ContentScriptManager();
    });
  } else {
    // DOM is already ready
    new ContentScriptManager();
  }
}