import { ExtensionSettings } from '@shared/types';
import { getSettings, getBlockedWebsites, getWhitelistedPaths, onStorageChanged } from '@shared/storage';
import { logger } from '@shared/logger';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { shouldBlockBasedOnWorkHours } from '@shared/workHoursUtils';
import { BlockingEngine } from './blockingEngine';
import { BlockedPageUI } from './ui/blockedPage';

class ContentScriptManager {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private blockingEngine: BlockingEngine;
  private blockedPageUI: BlockedPageUI;
  private currentUrl: string = '';
  private urlCheckInterval: number | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.blockingEngine = new BlockingEngine();
    this.blockedPageUI = new BlockedPageUI(this.settings);
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

    // Set up storage change listener
    this.setupStorageListener();

    // Set up navigation detection
    this.setupNavigationDetection();

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
            console.log('Work hours storage change detected:', {
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
      
      // Small delay to let the page settle, then check if new page should be blocked
      setTimeout(() => {
        this.checkAndBlock();
      }, 250);
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

    // Check work hours - if work hours are enabled and we're outside work hours, don't block
    if (!shouldBlockBasedOnWorkHours(this.settings.workHours)) {
      logger.log('Outside work hours, not blocking');
      this.blockedPageUI.removeBlockedPage();
      return;
    }

    // Don't block if already blocked (avoid duplicate overlays)
    if (this.blockedPageUI.isPageBlocked()) {
      logger.log('Page already blocked, skipping duplicate block');
      return;
    }

    if (this.blockingEngine.shouldBlockWebsite()) {
      logger.log('Site should be blocked!');
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
   * Clean up event listeners and intervals
   */
  private cleanup(): void {
    logger.log('Cleaning up content script');

    // Clean up blocked page UI
    this.blockedPageUI.cleanup();

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