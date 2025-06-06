// Settings management for options page
import { getSettings, saveSettings, resetSettings } from '../utils/storage-utils.js';
import { DEFAULT_SETTINGS, URL_SUGGESTIONS, DELAY_PRESETS } from '../utils/constants.js';
import { isValidUrl } from '../utils/url-utils.js';
import { showStatusMessage, updateToggleLabel, toggleVisibility } from '../utils/ui-utils.js';

export class SettingsManager {
  constructor() {
    this.elements = this.initializeElements();
    this.bindEvents();
    this.loadSettings();
  }

  initializeElements() {
    return {
      blockModeRadio: document.getElementById('blockMode'),
      redirectModeRadio: document.getElementById('redirectMode'),
      redirectSettings: document.getElementById('redirectSettings'),
      redirectUrl: document.getElementById('redirectUrl'),
      redirectDelay: document.getElementById('redirectDelay'),
      testRedirect: document.getElementById('testRedirect'),
      extensionEnabled: document.getElementById('extensionEnabled'),
      toggleLabel: document.getElementById('toggleLabel'),
      debugEnabled: document.getElementById('debugEnabled'),
      debugToggleLabel: document.getElementById('debugToggleLabel'),
      saveSettings: document.getElementById('saveSettings'),
      resetSettings: document.getElementById('resetSettings'),
      statusMessage: document.getElementById('statusMessage'),
      suggestionButtons: document.querySelectorAll('.suggestion-btn'),
      presetButtons: document.querySelectorAll('.preset-btn')
    };
  }

  bindEvents() {
    const { elements } = this;
    
    // Mode change events
    elements.blockModeRadio.addEventListener('change', () => this.updateRedirectVisibility());
    elements.redirectModeRadio.addEventListener('change', () => this.updateRedirectVisibility());
    
    // Toggle events
    elements.extensionEnabled.addEventListener('change', () => this.updateToggleLabel());
    elements.debugEnabled.addEventListener('change', () => this.updateDebugToggleLabel());
    
    // Button events
    elements.saveSettings.addEventListener('click', () => this.saveSettingsToStorage());
    elements.resetSettings.addEventListener('click', () => this.resetToDefaults());
    elements.testRedirect.addEventListener('click', () => this.testRedirectUrl());
    
    // Input events
    elements.redirectDelay.addEventListener('input', () => this.updatePresetButtons());
    elements.redirectUrl.addEventListener('input', () => this.validateRedirectUrl());
    
    // Auto-focus redirect URL when redirect mode is selected
    elements.redirectModeRadio.addEventListener('change', () => {
      if (elements.redirectModeRadio.checked) {
        setTimeout(() => elements.redirectUrl.focus(), 300);
      }
    });
    
    // Suggestion buttons
    elements.suggestionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.getAttribute('data-url');
        elements.redirectUrl.value = url;
        showStatusMessage(elements.statusMessage, 'URL updated! Remember to save settings.', 'success');
      });
    });
    
    // Preset buttons
    elements.presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const delay = parseInt(button.getAttribute('data-delay'));
        elements.redirectDelay.value = delay;
        this.updatePresetButtons();
        showStatusMessage(elements.statusMessage, 'Delay updated! Remember to save settings.', 'success');
      });
    });
  }

  async loadSettings() {
    try {
      const settings = await getSettings();
      
      // Set radio buttons
      if (settings.blockMode === 'block') {
        this.elements.blockModeRadio.checked = true;
      } else {
        this.elements.redirectModeRadio.checked = true;
      }

      // Set redirect URL and delay
      this.elements.redirectUrl.value = settings.redirectUrl;
      this.elements.redirectDelay.value = settings.redirectDelay;

      // Set extension enabled toggle
      this.elements.extensionEnabled.checked = settings.extensionEnabled;

      // Set debug enabled toggle
      this.elements.debugEnabled.checked = settings.debugEnabled;

      // Update UI
      this.updateRedirectVisibility();
      this.updateToggleLabel();
      this.updateDebugToggleLabel();
      this.updatePresetButtons();
      
    } catch (error) {
      showStatusMessage(this.elements.statusMessage, 'Error loading settings: ' + error.message, 'error');
    }
  }

  updateRedirectVisibility() {
    toggleVisibility(this.elements.redirectSettings, this.elements.redirectModeRadio.checked, 'enabled');
  }

  updateToggleLabel() {
    updateToggleLabel(
      this.elements.extensionEnabled,
      this.elements.toggleLabel,
      'Extension Enabled',
      'Extension Disabled'
    );
  }

  updateDebugToggleLabel() {
    updateToggleLabel(
      this.elements.debugEnabled,
      this.elements.debugToggleLabel,
      'Debug Enabled',
      'Debug Disabled'
    );
  }

  updatePresetButtons() {
    const currentDelay = parseInt(this.elements.redirectDelay.value);
    this.elements.presetButtons.forEach(button => {
      const buttonDelay = parseInt(button.getAttribute('data-delay'));
      button.classList.toggle('active', buttonDelay === currentDelay);
    });
  }

  validateRedirectUrl() {
    const url = this.elements.redirectUrl.value.trim();
    const isValid = !url || isValidUrl(url);
    
    this.elements.redirectUrl.style.borderColor = isValid 
      ? 'rgba(255, 255, 255, 0.3)' 
      : '#f44336';
      
    return isValid;
  }

  async saveSettingsToStorage() {
    const settings = {
      blockMode: this.elements.blockModeRadio.checked ? 'block' : 'redirect',
      redirectUrl: this.elements.redirectUrl.value.trim(),
      redirectDelay: parseInt(this.elements.redirectDelay.value) || 0,
      extensionEnabled: this.elements.extensionEnabled.checked,
      debugEnabled: this.elements.debugEnabled.checked
    };

    // Validate redirect URL if redirect mode is selected
    if (settings.blockMode === 'redirect') {
      if (!settings.redirectUrl) {
        showStatusMessage(this.elements.statusMessage, 'Please enter a redirect URL.', 'error');
        this.elements.redirectUrl.focus();
        return;
      }

      if (!isValidUrl(settings.redirectUrl)) {
        showStatusMessage(this.elements.statusMessage, 'Please enter a valid URL (must start with http:// or https://).', 'error');
        this.elements.redirectUrl.focus();
        return;
      }
    }

    // Validate redirect delay
    if (settings.redirectDelay < 0 || settings.redirectDelay > 30) {
      showStatusMessage(this.elements.statusMessage, 'Redirect delay must be between 0 and 30 seconds.', 'error');
      this.elements.redirectDelay.focus();
      return;
    }

    try {
      await saveSettings(settings);
      showStatusMessage(this.elements.statusMessage, 'Settings saved successfully!', 'success');
      
      // Animate save button
      const originalText = this.elements.saveSettings.textContent;
      this.elements.saveSettings.style.background = '#66BB6A';
      this.elements.saveSettings.textContent = '✓ SAVED';
      
      setTimeout(() => {
        this.elements.saveSettings.style.background = '#4CAF50';
        this.elements.saveSettings.textContent = originalText;
      }, 2000);
      
    } catch (error) {
      showStatusMessage(this.elements.statusMessage, 'Error saving settings: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This will not affect your blocked sites list or whitelisted paths.')) {
      try {
        await resetSettings();
        showStatusMessage(this.elements.statusMessage, 'Settings reset to defaults!', 'success');
        this.loadSettings(); // Reload the UI
      } catch (error) {
        showStatusMessage(this.elements.statusMessage, 'Error resetting settings: ' + error.message, 'error');
      }
    }
  }

  testRedirectUrl() {
    const url = this.elements.redirectUrl.value.trim();
    
    if (!url) {
      showStatusMessage(this.elements.statusMessage, 'Please enter a URL to test.', 'error');
      this.elements.redirectUrl.focus();
      return;
    }

    if (!isValidUrl(url)) {
      showStatusMessage(this.elements.statusMessage, 'Please enter a valid URL (must start with http:// or https://).', 'error');
      this.elements.redirectUrl.focus();
      return;
    }

    // Open URL in new tab to test
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        showStatusMessage(this.elements.statusMessage, 'Error opening URL: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatusMessage(this.elements.statusMessage, 'Test URL opened in new tab!', 'success');
        
        // Animate test button
        const originalText = this.elements.testRedirect.textContent;
        this.elements.testRedirect.style.background = '#66BB6A';
        this.elements.testRedirect.textContent = '✓ OPENED';
        
        setTimeout(() => {
          this.elements.testRedirect.style.background = '#FF9800';
          this.elements.testRedirect.textContent = originalText;
        }, 2000);
      }
    });
  }
}