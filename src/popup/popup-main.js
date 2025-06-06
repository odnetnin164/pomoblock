/**
 * Main popup script entry point
 */

import { getBlockedWebsites, getWhitelistedPaths } from '../shared/utils/storage.js';
import { SiteAnalyzer } from './site-analyzer.js';
import { PopupActions } from './actions.js';

class PopupMain {
  constructor() {
    this.siteAnalyzer = new SiteAnalyzer();
    this.actions = new PopupActions();
    this.currentTabUrl = '';
    this.targetToBlock = '';
    this.isAlreadyBlocked = false;
    this.isWhitelisted = false;
    
    this.initializeElements();
    this.init();
  }

  initializeElements() {
    this.statusDisplay = document.getElementById('statusDisplay');
    this.siteCount = document.getElementById('siteCount');
    this.currentUrl = document.getElementById('currentUrl');
    this.blockTarget = document.getElementById('blockTarget');
    this.blockCurrentButton = document.getElementById('blockCurrentButton');
    this.manageButton = document.getElementById('manageButton');
    this.optionsButton = document.getElementById('optionsButton');
  }

  async init() {
    try {
      // Load data and current tab info
      await this.loadSiteCount();
      await this.getCurrentTabInfo();
      
      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing popup:', error);
    }
  }

  setupEventListeners() {
    this.blockCurrentButton.addEventListener('click', () => this.handleBlockAction());
    this.manageButton.addEventListener('click', () => this.openOptionsPage());
    this.optionsButton.addEventListener('click', () => this.openOptionsPage());
  }

  async loadSiteCount() {
    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);
      
      this.siteCount.textContent = blockedWebsites.length;
      
      // Show whitelist count if there are any
      if (whitelistedPaths.length > 0) {
        this.statusDisplay.innerHTML = `
          <span id="siteCount">${blockedWebsites.length}</span> sites blocked<br>
          <small>${whitelistedPaths.length} paths whitelisted</small>
        `;
      }
    } catch (error) {
      console.error('Error loading site count:', error);
      this.siteCount.textContent = '0';
    }
  }

  async getCurrentTabInfo() {
    try {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, resolve);
      });
      
      if (tabs[0] && tabs[0].url) {
        this.currentTabUrl = tabs[0].url;
        await this.displayCurrentSite(this.currentTabUrl);
        await this.checkCurrentSiteStatus();
      } else {
        this.currentUrl.textContent = 'Unable to access current page';
        this.blockCurrentButton.disabled = true;
      }
    } catch (error) {
      console.error('Error getting current tab info:', error);
      this.currentUrl.textContent = 'Error accessing current page';
      this.blockCurrentButton.disabled = true;
    }
  }

  async displayCurrentSite(url) {
    try {
      const analysis = this.siteAnalyzer.analyzeSite(url);
      
      if (!analysis.canBlock) {
        this.currentUrl.textContent = analysis.displayUrl;
        this.blockTarget.textContent = 'Cannot block this page';
        this.blockCurrentButton.disabled = true;
        return;
      }
      
      this.currentUrl.textContent = analysis.displayUrl;
      this.targetToBlock = analysis.blockTarget;
      this.blockTarget.textContent = `Will block: ${this.targetToBlock}`;
      
      // Add special styling for certain sites
      if (analysis.isSpecialSite) {
        document.querySelector('.site-info').classList.add('special-site');
      }
    } catch (error) {
      console.error('Error displaying current site:', error);
      this.currentUrl.textContent = 'Invalid URL';
      this.blockCurrentButton.disabled = true;
    }
  }

  async checkCurrentSiteStatus() {
    if (!this.targetToBlock) return;
    
    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);
      
      this.isAlreadyBlocked = blockedWebsites.includes(this.targetToBlock);
      this.isWhitelisted = this.siteAnalyzer.checkIfWhitelisted(this.currentTabUrl, whitelistedPaths);
      
      this.updateButtonState();
    } catch (error) {
      console.error('Error checking site status:', error);
    }
  }

  updateButtonState() {
    if (this.isWhitelisted) {
      this.showWhitelistedState();
    } else if (this.isAlreadyBlocked) {
      this.showAlreadyBlockedState();
    } else {
      this.checkForWhitelistOption();
    }
  }

  showWhitelistedState() {
    this.blockCurrentButton.classList.add('already-blocked');
    this.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✅</span>
      <span class="btn-text">Whitelisted</span>
    `;
    this.blockCurrentButton.disabled = true;
    
    // Add whitelist info and remove button
    this.actions.showWhitelistInfo(this.currentTabUrl, () => {
      this.loadSiteCount();
      this.getCurrentTabInfo();
    });
  }

  showAlreadyBlockedState() {
    this.blockCurrentButton.classList.add('already-blocked');
    this.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✓</span>
      <span class="btn-text">Already Blocked</span>
    `;
    this.blockCurrentButton.disabled = true;
  }

  async checkForWhitelistOption() {
    try {
      const blockedWebsites = await getBlockedWebsites();
      const wouldBeBlocked = this.siteAnalyzer.wouldBeBlockedByExistingRule(
        this.currentTabUrl, 
        blockedWebsites
      );
      
      if (wouldBeBlocked && this.targetToBlock.includes('/')) {
        this.actions.showWhitelistOption(this.targetToBlock, () => {
          this.loadSiteCount();
          this.getCurrentTabInfo();
        });
      }
    } catch (error) {
      console.error('Error checking whitelist option:', error);
    }
  }

  async handleBlockAction() {
    if (this.isWhitelisted || this.isAlreadyBlocked) return;
    
    try {
      await this.actions.blockSite(this.targetToBlock, this.blockCurrentButton);
      this.isAlreadyBlocked = true;
      await this.loadSiteCount();
    } catch (error) {
      console.error('Error blocking site:', error);
    }
  }

  openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
    window.close();
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupMain();
});