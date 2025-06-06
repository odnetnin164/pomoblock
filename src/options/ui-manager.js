/**
 * UI management for options page
 */

import { COMMON_REDIRECT_URLS } from '../shared/constants/sites.js';
import { cleanURL, isValidDomain, isValidUrl } from '../shared/utils/url-utils.js';

export class UIManager {
  constructor() {
    this.optionsMain = null;
    this.suggestionButtons = [];
    this.presetButtons = [];
  }

  init(optionsMain) {
    this.optionsMain = optionsMain;
    this.suggestionButtons = document.querySelectorAll('.suggestion-btn');
    this.presetButtons = document.querySelectorAll('.preset-btn');
  }

  /**
   * Show status message to user
   * @param {string} message - Message to show
   * @param {string} type - Message type ('success' or 'error')
   */
  showStatusMessage(message, type) {
    const statusMessage = this.optionsMain.statusMessage;
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    
    // Hide message after 5 seconds
    setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 5000);
  }

  /**
   * Update redirect settings visibility
   */
  updateRedirectVisibility() {
    if (this.optionsMain.redirectModeRadio.checked) {
      this.optionsMain.redirectSettings.classList.add('enabled');
      // Auto-focus redirect URL when redirect mode is selected
      setTimeout(() => {
        this.optionsMain.redirectUrl.focus();
      }, 300);
    } else {
      this.optionsMain.redirectSettings.classList.remove('enabled');
    }
  }

  /**
   * Update extension toggle label
   */
  updateToggleLabel() {
    if (this.optionsMain.extensionEnabled.checked) {
      this.optionsMain.toggleLabel.textContent = 'Extension Enabled';
      this.optionsMain.toggleLabel.style.opacity = '1';
    } else {
      this.optionsMain.toggleLabel.textContent = 'Extension Disabled';
      this.optionsMain.toggleLabel.style.opacity = '0.7';
    }
  }

  /**
   * Update debug toggle label
   */
  updateDebugToggleLabel() {
    if (this.optionsMain.debugEnabled.checked) {
      this.optionsMain.debugToggleLabel.textContent = 'Debug Enabled';
      this.optionsMain.debugToggleLabel.style.opacity = '1';
    } else {
      this.optionsMain.debugToggleLabel.textContent = 'Debug Disabled';
      this.optionsMain.debugToggleLabel.style.opacity = '0.7';
    }
  }

  /**
   * Update preset buttons to show active state
   */
  updatePresetButtons() {
    const currentDelay = parseInt(this.optionsMain.redirectDelay.value);
    this.presetButtons.forEach(button => {
      const buttonDelay = parseInt(button.getAttribute('data-delay'));
      if (buttonDelay === currentDelay) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Animate save button on success
   */
  animateSaveButton() {
    const button = this.optionsMain.saveSettings;
    const originalText = button.textContent;
    button.style.background = '#66BB6A';
    button.textContent = '✓ SAVED';
    
    setTimeout(() => {
      button.style.background = '#4CAF50';
      button.textContent = originalText;
    }, 2000);
  }

  /**
   * Set up suggestion button listeners
   */
  setupSuggestionButtons() {
    this.suggestionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.getAttribute('data-url');
        this.optionsMain.redirectUrl.value = url;
        this.showStatusMessage('URL updated! Remember to save settings.', 'success');
      });
    });
  }

  /**
   * Set up preset button listeners
   */
  setupPresetButtons() {
    this.presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const delay = parseInt(button.getAttribute('data-delay'));
        this.optionsMain.redirectDelay.value = delay;
        this.updatePresetButtons();
        this.showStatusMessage('Delay updated! Remember to save settings.', 'success');
      });
    });
  }

  /**
   * Set up input validation
   */
  setupInputValidation() {
    // Redirect URL validation
    this.optionsMain.redirectUrl.addEventListener('input', () => {
      const url = this.optionsMain.redirectUrl.value.trim();
      if (url && !isValidUrl(url)) {
        this.optionsMain.redirectUrl.style.borderColor = '#f44336';
      } else {
        this.optionsMain.redirectUrl.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      }
    });

    // New site input validation
    this.optionsMain.newSiteInput.addEventListener('input', () => {
      const site = this.optionsMain.newSiteInput.value.trim();
      if (site && !isValidDomain(cleanURL(site))) {
        this.optionsMain.newSiteInput.style.borderColor = '#f44336';
      } else {
        this.optionsMain.newSiteInput.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      }
    });

    // New whitelist input validation
    this.optionsMain.newWhitelistInput.addEventListener('input', () => {
      const path = this.optionsMain.newWhitelistInput.value.trim();
      if (path && !isValidDomain(cleanURL(path))) {
        this.optionsMain.newWhitelistInput.style.borderColor = '#f44336';
      } else {
        this.optionsMain.newWhitelistInput.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      }
    });
  }
}