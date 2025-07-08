// src/contentScript/index.ts
import { ExtensionSettings } from '@shared/types';
import { 
  getSettings, 
  getBlockedWebsites, 
  getWhitelistedPaths, 
  getBlockedSitesToggleState,
  getWhitelistedPathsToggleState,
  onStorageChanged 
} from '@shared/storage';
import { logger } from '@shared/logger';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { shouldBlockBasedOnWorkHours } from '@shared/workHoursUtils';
import { BlockingEngine } from './blockingEngine';
import { BlockedPageUI } from './ui/blockedPage';
import { FloatingTimer } from './ui/floatingTimer';
import { TimerState } from '@shared/pomodoroTypes';
import { AudioManager } from '@shared/audioManager';

class ContentScriptManager {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private blockingEngine: BlockingEngine;
  private blockedPageUI: BlockedPageUI;
  private floatingTimer: FloatingTimer;
  private currentUrl: string = '';
  private urlCheckInterval: number | null = null;
  private isInitialized: boolean = false;
  private currentTimerState: TimerState = 'STOPPED';
  private audioManager: AudioManager | null = null;

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
      logger.debug('Content script already initialized, skipping', undefined, 'SYSTEM');
      return;
    }

    logger.info('ContentScript initializing', undefined, 'SYSTEM');
    logger.debug('Current URL', window.location.href, 'NAVIGATION');
    logger.debug('Document ready state', document.readyState, 'SYSTEM');

    // Load settings and site lists
    await this.loadConfiguration();

    // Initialize floating timer
    await this.floatingTimer.initialize();

    // Check timer state
    await this.checkTimerState();

    // Set up storage change listener
    this.setupStorageListener();

    // Set up navigation detection
    this.setupNavigationDetection();

    // Set up timer message listener
    this.setupTimerMessageListener();

    // Check if current site should be blocked
    this.checkAndBlock();

    this.isInitialized = true;
    logger.info('ContentScript fully initialized', undefined, 'SYSTEM');
  }

  /**
   * Load all configuration from storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      logger.debug('Loading configuration from storage', undefined, 'STORAGE');

      // Load settings
      this.settings = await getSettings();
      logger.debug('Loaded settings', this.settings, 'STORAGE');

      // Update logger debug state
      logger.setDebugEnabled(this.settings.debugEnabled);

      // Update UI with current settings
      this.blockedPageUI.updateSettings(this.settings);

      // If extension is disabled, don't continue
      if (!this.settings.extensionEnabled) {
        logger.info('Extension is disabled, cleaning up and exiting', undefined, 'SYSTEM');
        this.blockedPageUI.removeBlockedPage();
        return;
      }

      // Load blocked websites and their toggle states
      const [blockedWebsites, blockedToggleState] = await Promise.all([
        getBlockedWebsites(),
        getBlockedSitesToggleState()
      ]);
      logger.debug('Loaded blocked websites', blockedWebsites, 'STORAGE');
      logger.debug('Loaded blocked sites toggle state', blockedToggleState, 'STORAGE');
      this.blockingEngine.updateBlockedSites(blockedWebsites);
      this.blockingEngine.updateBlockedSitesToggleState(blockedToggleState);

      // Load whitelisted paths and their toggle states
      const [whitelistedPaths, whitelistToggleState] = await Promise.all([
        getWhitelistedPaths(),
        getWhitelistedPathsToggleState()
      ]);
      logger.debug('Loaded whitelisted paths', whitelistedPaths, 'STORAGE');
      logger.debug('Loaded whitelisted paths toggle state', whitelistToggleState, 'STORAGE');
      this.blockingEngine.updateWhitelistedPaths(whitelistedPaths);
      this.blockingEngine.updateWhitelistedPathsToggleState(whitelistToggleState);

    } catch (error) {
      logger.error('Error loading configuration', (error as Error).message, 'STORAGE');
    }
  }

  /**
   * Check current timer state
   */
  private async checkTimerState(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATUS' });
      if (response.status && response.status.state) {
        this.currentTimerState = response.status.state;
        logger.debug('Timer state:', this.currentTimerState, 'TIMER');
      } else {
        this.currentTimerState = 'STOPPED';
      }
    } catch (error) {
      logger.error('Error checking timer state', (error as Error).message, 'TIMER');
      this.currentTimerState = 'STOPPED';
    }
  }

  /**
   * Set up storage change listener
   */
  private setupStorageListener(): void {
    onStorageChanged((changes, areaName) => {
      if (areaName === 'sync') {
        logger.debug('Storage changed', changes, 'STORAGE');

        // Handle blocked websites, whitelisted paths, or toggle states changes
        if (changes.blockedWebsitesArray || 
            changes.whitelistedPathsArray || 
            changes.blockedSitesToggleState || 
            changes.whitelistedPathsToggleState) {
          logger.info('Blocked websites, whitelisted paths, or toggle states changed, reloading configuration', undefined, 'STORAGE');
          this.loadConfiguration().then(() => {
            // Force re-check current page after configuration update
            this.forceRecheck();
          });
          return;
        }

        // Handle work hours changes - reload full configuration if any work hours setting changed
        if (changes.workHoursEnabled !== undefined || 
            changes.workHoursStartTime !== undefined || 
            changes.workHoursEndTime !== undefined || 
            changes.workHoursDays !== undefined) {
          logger.info('Work hours settings changed, reloading configuration', undefined, 'STORAGE');
          this.loadConfiguration().then(() => {
            // Force re-check current page after work hours update
            this.forceRecheck();
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
            logger.info('Extension disabled, cleaning up', undefined, 'SYSTEM');
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
            logger.debug('Work hours storage change detected:', {
              workHoursEnabled: changes.workHoursEnabled,
              workHoursStartTime: changes.workHoursStartTime,
              workHoursEndTime: changes.workHoursEndTime,
              workHoursDays: changes.workHoursDays
            }, 'STORAGE');
          }
        }

        if (settingsChanged) {
          this.blockedPageUI.updateSettings(this.settings);
          logger.debug('Settings updated', this.settings, 'STORAGE');
          
          // Force re-check blocking status with new settings
          this.forceRecheck();
        }
      }
    });
  }

  /**
   * Set up navigation detection to catch URL changes
   */
  private setupNavigationDetection(): void {
    logger.debug('Setting up navigation detection', undefined, 'NAVIGATION');

    // Method 1: Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', (event) => {
      logger.debug('Navigation detected: popstate', event.state, 'NAVIGATION');
      this.handleNavigationChange();
    });

    // Method 2: Override pushState and replaceState to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      logger.debug('Navigation detected: pushState', undefined, 'NAVIGATION');
      setTimeout(() => {
        (window as any).contentScriptManager?.handleNavigationChange();
      }, 100);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      logger.debug('Navigation detected: replaceState', undefined, 'NAVIGATION');
      setTimeout(() => {
        (window as any).contentScriptManager?.handleNavigationChange();
      }, 100);
    };

    // Method 3: Listen for hashchange events
    window.addEventListener('hashchange', () => {
      logger.debug('Navigation detected: hashchange', undefined, 'NAVIGATION');
      this.handleNavigationChange();
    });

    // Method 4: Listen for focus events (tab switching back)
    window.addEventListener('focus', () => {
      logger.debug('Window focus detected, checking URL', undefined, 'NAVIGATION');
      this.handleNavigationChange();
    });

    // Method 5: Listen for visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        logger.debug('Tab became visible, updating floating timer', undefined, 'NAVIGATION');
        this.handleTabBecameVisible();
      }
    });

    // Method 6: Periodic URL checking as fallback (every 2 seconds)
    this.urlCheckInterval = window.setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        logger.debug('Navigation detected: periodic check', undefined, 'NAVIGATION');
        this.handleNavigationChange();
      }
    }, 2000);

    // Method 7: Listen for DOM changes that might indicate navigation
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
      if (message.type === 'TIMER_UPDATE') {
        logger.debug('Timer message received:', message.type, 'TIMER');
        // Update timer state immediately from the message
        if (message.data && message.data.timerStatus) {
          const previousState = this.currentTimerState;
          this.currentTimerState = message.data.timerStatus.state;
          logger.info('Timer state updated', { from: previousState, to: this.currentTimerState }, 'TIMER');
          
          // Update blocked page UI with new timer state
          this.blockedPageUI.setTimerState(this.currentTimerState);
          
          // Only re-check blocking if the timer state actually changed (not just time remaining)
          if (previousState !== this.currentTimerState) {
            logger.info('Timer state changed, using graceful transition handling', undefined, 'TIMER');
            
            // If timer just started work session, media will be paused when/if a page gets blocked
            if (previousState !== 'WORK' && this.currentTimerState === 'WORK') {
              logger.debug('Work session started - media will be paused if any blocked sites are accessed', undefined, 'TIMER');
            }
            
            // Use graceful timer state transition instead of checkAndBlock
            const shouldBeBlocked = this.shouldCurrentPageBeBlocked();
            this.blockedPageUI.handleTimerStateTransition(this.currentTimerState, shouldBeBlocked);
          } else {
            logger.debug('Timer time remaining updated, but state unchanged - no blocking check needed', undefined, 'TIMER');
          }
        }
      } else if (message.type === 'TIMER_COMPLETE') {
        logger.info('Timer completion message received:', message.type, 'TIMER');
        // Timer completed, check new state
        this.checkTimerState().then(() => {
          this.checkAndBlock();
        });
      } else if (message.type === 'UPDATE_FLOATING_TIMER') {
        // Handle floating timer settings updates
        this.floatingTimer.setAlwaysShow(message.alwaysShow);
      } else if (message.type === 'BLOCKING_CONFIG_CHANGED') {
        logger.debug('Received immediate blocking config change notification', undefined, 'BLOCKING');
        // Immediately reload configuration and re-check blocking
        this.loadConfiguration().then(() => {
          this.forceRecheck();
        });
      } else if (message.type === 'TEST_BUILT_IN_SOUND') {
        logger.debug('Test built-in sound message received:', message.data, 'AUDIO');
        this.testBuiltInSound(message.data.soundId, message.data.volume);
      } else if (message.type === 'TEST_CUSTOM_SOUND_PLAYBACK') {
        logger.debug('Test custom sound message received:', message.data, 'AUDIO');
        this.testCustomSound(message.data.dataUrl, message.data.volume);
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
          logger.debug('Navigation detected: DOM mutation', undefined, 'NAVIGATION');
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
      logger.debug('URL changed', { from: this.currentUrl, to: newUrl }, 'NAVIGATION');
      
      const wasBlocked = this.blockedPageUI.isPageBlocked();
      this.currentUrl = newUrl;
      
      // If we were showing a blocked page and now navigated away, remove it and clear any timers
      if (wasBlocked) {
        logger.debug('Navigation detected: removing blocked page overlay and clearing timers', undefined, 'NAVIGATION');
        this.blockedPageUI.removeBlockedPage();
      }
      
      // Check timer status and update floating timer
      this.checkTimerState().then(() => {
        // Update floating timer status after navigation
        this.floatingTimer.requestTimerStatus();
        
        setTimeout(() => {
          this.checkAndBlock();
        }, 250);
      });
    }
  }

  /**
   * Handle tab becoming visible (tab switching)
   */
  private handleTabBecameVisible(): void {
    logger.debug('Tab became visible, refreshing state', undefined, 'NAVIGATION');
    
    // Check for URL changes that might have happened while tab was hidden
    this.handleNavigationChange();
    
    // Refresh timer status and floating timer
    this.checkTimerState().then(() => {
      this.floatingTimer.requestTimerStatus();
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        this.checkAndBlock();
      }, 100);
    });
  }

  /**
   * Force a re-check of blocking rules regardless of current state
   */
  private forceRecheck(): void {
    logger.debug('Force re-check triggered for URL:', window.location.href, 'BLOCKING');
    
    // Update current URL to ensure navigation detection works properly
    this.currentUrl = window.location.href;
    
    // Perform the check and block action
    this.checkAndBlock();
  }

  /**
   * Check if current site should be blocked and take action
   */
  private checkAndBlock(): void {
    logger.debug('checkAndBlock called for URL:', window.location.href, 'BLOCKING');
    logger.debug('Current timer state:', this.currentTimerState, 'TIMER');

    // Don't block if extension is disabled
    if (!this.settings.extensionEnabled) {
      logger.debug('Extension disabled, removing any existing block', undefined, 'BLOCKING');
      this.blockedPageUI.removeBlockedPage();
      return;
    }

    // Check if page is currently blocked
    const isCurrentlyBlocked = this.blockedPageUI.isPageBlocked();
    
    // Determine if page should be blocked based on current rules
    const shouldBlock = this.shouldCurrentPageBeBlocked();
    
    // If page is blocked but shouldn't be, unblock it immediately
    if (isCurrentlyBlocked && !shouldBlock) {
      logger.debug('Page currently blocked but should no longer be blocked, removing block', undefined, 'BLOCKING');
      this.blockedPageUI.removeBlockedPage();
      return;
    }
    
    // If page is already blocked and should remain blocked, just update the content instead of recreating
    if (isCurrentlyBlocked && shouldBlock) {
      logger.info('Page already blocked and should remain blocked, updating blocked page content in place', undefined, 'UI');
      this.blockedPageUI.updateBlockedPageContent();
      return;
    }

    // If page should be blocked and isn't currently blocked, block it
    if (shouldBlock) {
      logger.info('Site should be blocked by current rules!', undefined, 'BLOCKING');
      logger.debug('Block mode is', this.settings.blockMode, 'BLOCKING');

      if (this.settings.blockMode === 'redirect') {
        logger.debug('Redirect mode - showing blocked page with countdown', undefined, 'BLOCKING');
        this.blockedPageUI.createBlockedPage(true);
      } else {
        logger.debug('Block mode - showing blocked page', undefined, 'BLOCKING');
        this.blockedPageUI.createBlockedPage(false);
      }
    } else {
      logger.debug('Site should NOT be blocked by current rules', undefined, 'BLOCKING');
      // Make sure any existing block overlay is removed
      this.blockedPageUI.removeBlockedPage();
    }
  }

  /**
   * Determine if the current page should be blocked based on all rules
   */
  private shouldCurrentPageBeBlocked(): boolean {
    // Don't block if extension is disabled
    if (!this.settings.extensionEnabled) {
      return false;
    }

    // INTEGRATED POMODORO BLOCKING LOGIC:
    // 1. If timer is in REST period, never block any websites
    if (this.currentTimerState === 'REST') {
      logger.debug('Timer is in REST period, not blocking any websites', undefined, 'BLOCKING');
      return false;
    }

    // 2. If timer is in WORK period, always apply normal blocking rules
    // 3. If timer is STOPPED or PAUSED, apply normal blocking rules
    // (Both cases handled by the same logic below)

    // Check work hours - if work hours are enabled and we're outside work hours, don't block
    // (unless timer is in WORK period, which overrides work hours)
    if (this.currentTimerState !== 'WORK' && !shouldBlockBasedOnWorkHours(this.settings.workHours)) {
      logger.debug('Outside work hours and timer not in work period, not blocking', undefined, 'BLOCKING');
      return false;
    }

    // Apply normal blocking rules using the centralized method
    return this.blockingEngine.shouldUrlBeBlocked();
  }

  /**
   * Clean up event listeners and intervals
   */
  private cleanup(): void {
    logger.debug('Cleaning up content script', undefined, 'SYSTEM');

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
    
    if (this.audioManager) {
      this.audioManager.destroy().catch(() => {
        // Ignore cleanup errors
      });
      this.audioManager = null;
    }
    
    this.isInitialized = false;
    logger.debug('Content script cleaned up', undefined, 'SYSTEM');
  }

  /**
   * Initialize audio manager if needed
   */
  private async initializeAudioManagerIfNeeded(): Promise<void> {
    if (!this.audioManager) {
      const audioSettings = AudioManager.getDefaultSettings();
      this.audioManager = new AudioManager(audioSettings);
      await this.audioManager.initialize();
    }
  }

  /**
   * Test a built-in sound
   */
  private async testBuiltInSound(soundId: string, volume: number): Promise<void> {
    try {
      await this.initializeAudioManagerIfNeeded();
      
      if (this.audioManager) {
        // Create temporary settings for testing
        const testSettings = AudioManager.getDefaultSettings();
        testSettings.volume = volume;
        testSettings.sounds.work_complete.id = soundId;
        
        this.audioManager.updateSettings(testSettings);
        await this.audioManager.playSound('work_complete');
      }
    } catch (error) {
      logger.error('Error testing built-in sound:', error, 'AUDIO');
    }
  }

  /**
   * Test a custom sound using data URL
   */
  private async testCustomSound(dataUrl: string, volume: number): Promise<void> {
    try {
      if (!dataUrl) return;
      
      // Create and play audio element directly for custom sounds
      const audio = new Audio(dataUrl);
      audio.volume = volume / 100;
      audio.play().catch(error => {
        logger.error('Error playing custom sound:', error, 'AUDIO');
      });
    } catch (error) {
      logger.error('Error testing custom sound:', error, 'AUDIO');
    }
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