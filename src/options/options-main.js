/**
 * Main options page script entry point
 */

import { getSettings, saveSettings } from '../shared/utils/storage.js';
import { DEFAULT_SETTINGS } from '../shared/config/defaults.js';
import { SettingsManager } from './settings-manager.js';
import { SiteManager } from './site-manager.js';
import { WhitelistManager } from './whitelist-manager.js';
import { UIManager } from './ui-manager.js';

class OptionsMain {
  constructor() {
    this.settingsManager = new SettingsManager();
    this.siteManager = new SiteManager();
    this.whitelistManager = new WhitelistManager();
    this.uiManager = new UIManager();
    
    this.initializeElements();
    this.init();
  }

  initializeElements() {
    // Settings elements
    this.blockModeRadio = document.getElementById('blockMode');
    this.redirectModeRadio = document.getElementById('redirectMode');
    this.redirectSettings = document.getElementById('redirectSettings');
    this.redirectUrl = document.getElementById('redirectUrl');
    this.redirectDelay = document.getElementById('redirectDelay');
    this.testRedirect = document.getElementById('testRedirect');
    this.extensionEnabled = document.getElementById('extensionEnabled');
    this.toggleLabel = document.getElementById('toggleLabel');
    this.debugEnabled = document.getElementById('debugEnabled');
    this.debugToggleLabel = document.getElementById('debugToggleLabel');
    this.saveSettings = document.getElementById('saveSettings');
    this.resetSettings = document.getElementById('resetSettings');
    this.statusMessage = document.getElementById('statusMessage');
    
    // Site management elements
    this.newSiteInput = document.getElementById('newSiteInput');
    this.addSiteButton = document.getElementById('addSiteButton');
    this.blockedSitesList = document.getElementById('blockedSitesList');
    this.sitesCount = document.getElementById('sitesCount');
    this.clearAllSites = document.getElementById('clearAllSites');

    // Whitelist management elements
    this.newWhitelistInput = document.getElementById('newWhitelistInput');
    this.addWhitelistButton = document.getElementById('addWhitelistButton');
    this.whitelistedPathsList = document.getElementById('whitelistedPathsList');
    this.whitelistCount = document.getElementById('whitelistCount');
    this.clearAllWhitelist = document.getElementById('clearAllWhitelist');
  }

  async init() {
    try {
      // Initialize managers
      this.settingsManager.init(this);
      this.siteManager.init(this);
      this.whitelistManager.init(this);
      this.uiManager.init(this);
      
      // Load initial data
      await this.loadSettings();
      await this.siteManager.loadBlockedSites();
      await this.whitelistManager.loadWhitelistedPaths();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Focus the new site input
      this.newSiteInput.focus();
    } catch (error) {
      console.error('Error initializing options page:', error);
      this.uiManager.showStatusMessage('Error loading options page', 'error');
    }
  }

  setupEventListeners() {
    // Settings event listeners
    this.blockModeRadio.addEventListener('change', () => this.uiManager.updateRedirectVisibility());
    this.redirectModeRadio.addEventListener('change', () => this.uiManager.updateRedirectVisibility());
    this.extensionEnabled.addEventListener('change', () => this.uiManager.updateToggleLabel());
    this.debugEnabled.addEventListener('change', () => this.uiManager.updateDebugToggleLabel());
    this.saveSettings.addEventListener('click', () => this.handleSaveSettings());
    this.resetSettings.addEventListener('click', () => this.handleResetSettings());
    this.testRedirect.addEventListener('click', () => this.settingsManager.testRedirectUrl());
    this.redirectDelay.addEventListener('input', () => this.uiManager.updatePresetButtons());

    // Site management event listeners
    this.addSiteButton.addEventListener('click', () => this.siteManager.addNewSite());
    this.newSiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.siteManager.addNewSite();
      }
    });
    this.clearAllSites.addEventListener('click', () => this.siteManager.clearAllBlockedSites());

    // Whitelist management event listeners
    this.addWhitelistButton.addEventListener('click', () => this.whitelistManager.addNewWhitelistPath());
    this.newWhitelistInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.whitelistManager.addNewWhitelistPath();
      }
    });
    this.clearAllWhitelist.addEventListener('click', () => this.whitelistManager.clearAllWhitelistedPaths());

    // UI event listeners
    this.uiManager.setupSuggestionButtons();
    this.uiManager.setupPresetButtons();
    this.uiManager.setupInputValidation();
  }

  async loadSettings() {
    try {
      const settings = await getSettings();
      this.settingsManager.populateSettings(settings);
      this.uiManager.updateRedirectVisibility();
      this.uiManager.updateToggleLabel();
      this.uiManager.updateDebugToggleLabel();
      this.uiManager.updatePresetButtons();
    } catch (error) {
      console.error('Error loading settings:', error);
      this.uiManager.showStatusMessage('Error loading settings', 'error');
    }
  }

  async handleSaveSettings() {
    try {
      const settings = this.settingsManager.collectSettings();
      
      // Validate settings
      const validation = this.settingsManager.validateSettings(settings);
      if (!validation.isValid) {
        this.uiManager.showStatusMessage(validation.message, 'error');
        if (validation.focusElement) {
          validation.focusElement.focus();
        }
        return;
      }

      // Save settings
      await saveSettings(settings);
      this.uiManager.showStatusMessage('Settings saved successfully!', 'success');
      this.uiManager.animateSaveButton();
    } catch (error) {
      console.error('Error saving settings:', error);
      this.uiManager.showStatusMessage('Error saving settings: ' + error.message, 'error');
    }
  }

  async handleResetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This will not affect your blocked sites list or whitelisted paths.')) {
      try {
        await saveSettings(DEFAULT_SETTINGS);
        this.uiManager.showStatusMessage('Settings reset to defaults!', 'success');
        await this.loadSettings();
      } catch (error) {
        console.error('Error resetting settings:', error);
        this.uiManager.showStatusMessage('Error resetting settings: ' + error.message, 'error');
      }
    }
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsMain();
});