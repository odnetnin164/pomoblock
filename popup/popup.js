// Main popup script for PomoBlock extension
import { TabAnalyzer } from './popup/tab-analyzer.js';
import { SiteActions } from './popup/site-actions.js';
import { PopupUI } from './popup/popup-ui.js';

class PopupController {
  constructor() {
    this.tabAnalyzer = new TabAnalyzer();
    this.siteActions = new SiteActions(this.tabAnalyzer);
    this.ui = new PopupUI();
    
    this.initialize();
  }

  async initialize() {
    try {
      // Load site count and current tab info
      await Promise.all([
        this.ui.loadSiteCount(),
        this.loadCurrentTabInfo()
      ]);
      
      // Setup event listeners
      this.setupEventListeners();
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.ui.showInvalidPage();
    }
  }

  async loadCurrentTabInfo() {
    try {
      const tab = await this.tabAnalyzer.getCurrentTabInfo();
      
      if (!tab || !tab.url) {
        this.ui.showInvalidPage();
        return;
      }

      // Analyze current tab
      const analysis = this.tabAnalyzer.analyzeCurrentTab();
      this.ui.displayCurrentSite(analysis);

      if (analysis.canBlock) {
        // Check current site status
        const status = await this.tabAnalyzer.checkCurrentSiteStatus();
        this.ui.updateButtonState(status);
        
        // Show whitelist option if applicable
        if (!status.isWhitelisted && !status.isBlocked) {
          const shouldShowWhitelist = await this.siteActions.shouldShowWhitelistOption();
          if (shouldShowWhitelist) {
            this.ui.showWhitelistOption();
          }
        }
      }
    } catch (error) {
      console.error('Error loading tab info:', error);
      this.ui.showInvalidPage();
    }
  }

  setupEventListeners() {
    // Main block button
    this.ui.elements.blockCurrentButton.addEventListener('click', () => {
      this.handleBlockAction();
    });

    // Navigation buttons
    this.ui.elements.manageButton.addEventListener('click', () => {
      this.ui.openOptionsPage();
    });

    this.ui.elements.optionsButton.addEventListener('click', () => {
      this.ui.openOptionsPage();
    });

    // Dynamic button listeners (using event delegation)
    document.addEventListener('click', (e) => {
      if (e.target.id === 'whitelistCurrentButton') {
        this.handleWhitelistAction();
      } else if (e.target.id === 'removeWhitelistButton') {
        this.handleRemoveWhitelistAction();
      }
    });
  }

  async handleBlockAction() {
    const { isWhitelisted, isAlreadyBlocked } = this.tabAnalyzer.getState();
    
    if (isWhitelisted || isAlreadyBlocked) {
      return;
    }

    try {
      this.ui.setBlockButtonLoading();
      
      const result = await this.siteActions.blockCurrentSite();
      
      if (result.success) {
        this.ui.showBlockButtonSuccess();
        await this.ui.loadSiteCount(); // Update site count
      }
    } catch (error) {
      console.error('Error blocking site:', error);
      this.ui.showButtonError('blockCurrentButton', 'Error');
    }
  }

  async handleWhitelistAction() {
    try {
      this.ui.setWhitelistButtonLoading('whitelistCurrentButton');
      
      const result = await this.siteActions.whitelistCurrentPath();
      
      if (result.success) {
        this.ui.showWhitelistButtonSuccess('whitelistCurrentButton');
        await this.ui.loadSiteCount(); // Update site count
      }
    } catch (error) {
      console.error('Error whitelisting path:', error);
      this.ui.showButtonError('whitelistCurrentButton', 'Error');
    }
  }

  async handleRemoveWhitelistAction() {
    try {
      this.ui.setRemoveWhitelistButtonLoading();
      
      const result = await this.siteActions.removeFromWhitelist();
      
      if (result.success) {
        this.ui.showRemoveWhitelistSuccess();
        await this.ui.loadSiteCount(); // Update site count
      }
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      this.ui.showButtonError('removeWhitelistButton', 'Error');
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});