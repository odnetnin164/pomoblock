/**
 * Settings management for options page
 */

import { isValidUrl } from '../shared/utils/url-utils.js';
import { VALIDATION_RULES } from '../shared/config/defaults.js';

export class SettingsManager {
  constructor() {
    this.optionsMain = null;
  }

  init(optionsMain) {
    this.optionsMain = optionsMain;
  }

  /**
   * Populate settings UI with current values
   * @param {Object} settings - Settings object
   */
  populateSettings(settings) {
    // Set radio buttons
    if (settings.blockMode === 'block') {
      this.optionsMain.blockModeRadio.checked = true;
    } else {
      this.optionsMain.redirectModeRadio.checked = true;
    }

    // Set redirect URL and delay
    this.optionsMain.redirectUrl.value = settings.redirectUrl;
    this.optionsMain.redirectDelay.value = settings.redirectDelay;

    // Set extension enabled toggle
    this.optionsMain.extensionEnabled.checked = settings.extensionEnabled;

    // Set debug enabled toggle
    this.optionsMain.debugEnabled.checked = settings.debugEnabled;
  }

  /**
   * Collect settings from UI
   * @returns {Object} Settings object
   */
  collectSettings() {
    return {
      blockMode: this.optionsMain.blockModeRadio.checked ? 'block' : 'redirect',
      redirectUrl: this.optionsMain.redirectUrl.value.trim(),
      redirectDelay: parseInt(this.optionsMain.redirectDelay.value) || 0,
      extensionEnabled: this.optionsMain.extensionEnabled.checked,
      debugEnabled: this.optionsMain.debugEnabled.checked
    };
  }

  /**
   * Validate settings
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validateSettings(settings) {
    // Validate redirect URL if redirect mode is selected
    if (settings.blockMode === 'redirect') {
      if (!settings.redirectUrl) {
        return {
          isValid: false,
          message: 'Please enter a redirect URL.',
          focusElement: this.optionsMain.redirectUrl
        };
      }

      if (!isValidUrl(settings.redirectUrl)) {
        return {
          isValid: false,
          message: 'Please enter a valid URL (must start with http:// or https://).',
          focusElement: this.optionsMain.redirectUrl
        };
      }
    }

    // Validate redirect delay
    const { min, max } = VALIDATION_RULES.redirectDelay;
    if (settings.redirectDelay < min || settings.redirectDelay > max) {
      return {
        isValid: false,
        message: `Redirect delay must be between ${min} and ${max} seconds.`,
        focusElement: this.optionsMain.redirectDelay
      };
    }

    return { isValid: true };
  }

  /**
   * Test redirect URL by opening it in a new tab
   */
  testRedirectUrl() {
    const url = this.optionsMain.redirectUrl.value.trim();
    
    if (!url) {
      this.optionsMain.uiManager.showStatusMessage('Please enter a URL to test.', 'error');
      this.optionsMain.redirectUrl.focus();
      return;
    }

    if (!isValidUrl(url)) {
      this.optionsMain.uiManager.showStatusMessage('Please enter a valid URL (must start with http:// or https://).', 'error');
      this.optionsMain.redirectUrl.focus();
      return;
    }

    // Open URL in new tab to test
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        this.optionsMain.uiManager.showStatusMessage('Error opening URL: ' + chrome.runtime.lastError.message, 'error');
      } else {
        this.optionsMain.uiManager.showStatusMessage('Test URL opened in new tab!', 'success');
        this.animateTestButton();
      }
    });
  }

  /**
   * Animate test button on success
   */
  animateTestButton() {
    const button = this.optionsMain.testRedirect;
    const originalText = button.textContent;
    button.style.background = '#66BB6A';
    button.textContent = '✓ OPENED';
    
    setTimeout(() => {
      button.style.background = '#FF9800';
      button.textContent = originalText;
    }, 2000);
  }
}