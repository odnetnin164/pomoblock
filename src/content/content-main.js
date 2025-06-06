/**
 * Main content script entry point
 */

import { getSettings, onStorageChanged } from '../shared/utils/storage.js';
import { debugLog, debugError, initDebug } from '../shared/utils/debug.js';
import { SiteBlocker } from './blocker.js';
import './ui/debug-overlay.js'; // Initialize debug overlay styles

class ContentScript {
  constructor() {
    this.blocker = null;
    this.settings = null;
    this.init();
  }

  async init() {
    try {
      debugLog('ContentScript started');
      debugLog('Current URL', window.location.href);
      debugLog('Document ready state', document.readyState);

      // Load settings and initialize
      await this.loadSettings();
      
      // Initialize site blocker
      this.blocker = new SiteBlocker(this.settings);
      
      // Check if current site should be blocked
      await this.blocker.checkAndBlock();
      
      // Listen for settings changes
      this.setupStorageListener();
      
      debugLog('ContentScript fully loaded');
    } catch (error) {
      debugError('Failed to initialize content script', error);
    }
  }

  async loadSettings() {
    try {
      this.settings = await getSettings();
      
      // Initialize debug system
      initDebug(this.settings.debugEnabled);
      
      debugLog('Settings loaded', this.settings);
    } catch (error) {
      debugError('Failed to load settings', error);
      // Use default settings if loading fails
      this.settings = {
        blockMode: 'block',
        redirectUrl: 'https://www.google.com',
        redirectDelay: 3,
        extensionEnabled: true,
        debugEnabled: false
      };
    }
  }

  setupStorageListener() {
    onStorageChanged((changes) => {
      debugLog('Storage changed', changes);
      
      // Handle blocked websites or whitelisted paths changes
      if (changes.blockedWebsitesArray || changes.whitelistedPathsArray) {
        debugLog('Blocked websites or whitelisted paths changed, reloading');
        location.reload();
        return;
      }
      
      // Handle settings changes
      let settingsChanged = false;
      const newSettings = { ...this.settings };
      
      if (changes.blockMode) {
        newSettings.blockMode = changes.blockMode.newValue || 'block';
        settingsChanged = true;
      }
      
      if (changes.redirectUrl) {
        newSettings.redirectUrl = changes.redirectUrl.newValue || 'https://www.google.com';
        settingsChanged = true;
      }
      
      if (changes.redirectDelay !== undefined) {
        newSettings.redirectDelay = changes.redirectDelay.newValue !== undefined ? 
          changes.redirectDelay.newValue : 3;
        settingsChanged = true;
      }
      
      if (changes.extensionEnabled !== undefined) {
        newSettings.extensionEnabled = changes.extensionEnabled.newValue;
        if (!newSettings.extensionEnabled) {
          location.reload();
          return;
        }
        settingsChanged = true;
      }
      
      if (changes.debugEnabled !== undefined) {
        newSettings.debugEnabled = changes.debugEnabled.newValue;
        initDebug(newSettings.debugEnabled);
        settingsChanged = true;
      }
      
      if (settingsChanged) {
        this.settings = newSettings;
        if (this.blocker) {
          this.blocker.updateSettings(this.settings);
        }
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ContentScript());
} else {
  new ContentScript();
}