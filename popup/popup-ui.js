// Popup UI management
import { getBlockedWebsites, getWhitelistedPaths } from '../utils/storage-utils.js';
import { setButtonLoading, resetButtonLoading, addTemporaryClass } from '../utils/ui-utils.js';

export class PopupUI {
  constructor() {
    this.elements = this.initializeElements();
  }

  initializeElements() {
    return {
      statusDisplay: document.getElementById('statusDisplay'),
      siteCount: document.getElementById('siteCount'),
      currentUrl: document.getElementById('currentUrl'),
      blockTarget: document.getElementById('blockTarget'),
      blockCurrentButton: document.getElementById('blockCurrentButton'),
      manageButton: document.getElementById('manageButton'),
      optionsButton: document.getElementById('optionsButton')
    };
  }

  /**
   * Load and display blocked sites count
   */
  async loadSiteCount() {
    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);
      
      this.elements.siteCount.textContent = blockedWebsites.length;
      
      // Also show whitelist count if there are any
      if (whitelistedPaths.length > 0) {
        this.elements.statusDisplay.innerHTML = `
          <span id="siteCount">${blockedWebsites.length}</span> sites blocked<br>
          <small>${whitelistedPaths.length} paths whitelisted</small>
        `;
      }
    } catch (error) {
      console.error('Error loading site count:', error);
    }
  }

  /**
   * Display current site information
   */
  displayCurrentSite(analysis) {
    const { displayUrl, target, canBlock, isSpecial } = analysis;
    
    this.elements.currentUrl.textContent = displayUrl;
    
    if (canBlock && target) {
      this.elements.blockTarget.textContent = `Will block: ${target}`;
      
      // Add special styling for certain sites
      if (isSpecial) {
        document.querySelector('.site-info').classList.add('special-site');
      }
    } else {
      this.elements.blockTarget.textContent = 'Cannot block this page';
      this.elements.blockCurrentButton.disabled = true;
    }
  }

  /**
   * Update button state based on site status
   */
  updateButtonState(status) {
    const { isWhitelisted, isBlocked } = status;
    
    if (isWhitelisted) {
      this.showWhitelistedState();
    } else if (isBlocked) {
      this.showBlockedState();
    } else {
      this.showNormalState();
    }
  }

  /**
   * Show whitelisted state UI
   */
  showWhitelistedState() {
    this.elements.blockCurrentButton.classList.add('already-blocked');
    this.elements.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✅</span>
      <span class="btn-text">Whitelisted</span>
    `;
    this.elements.blockCurrentButton.disabled = true;
    
    // Add whitelist notice with remove button
    this.addWhitelistNotice();
  }

  /**
   * Show blocked state UI
   */
  showBlockedState() {
    this.elements.blockCurrentButton.classList.add('already-blocked');
    this.elements.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✓</span>
      <span class="btn-text">Already Blocked</span>
    `;
    this.elements.blockCurrentButton.disabled = true;
  }

  /**
   * Show normal state UI
   */
  showNormalState() {
    this.elements.blockCurrentButton.classList.remove('already-blocked');
    this.elements.blockCurrentButton.innerHTML = `
      <span class="btn-icon">🚫</span>
      <span class="btn-text">Block This Page</span>
    `;
    this.elements.blockCurrentButton.disabled = false;
  }

  /**
   * Add whitelist notice with remove button
   */
  addWhitelistNotice() {
    const whitelistInfo = document.createElement('div');
    whitelistInfo.className = 'whitelist-notice';
    whitelistInfo.innerHTML = `
      <small style="color: #4CAF50; margin-bottom: 15px; display: block;">
        This page is whitelisted and won't be blocked
      </small>
      <button class="remove-whitelist-btn" id="removeWhitelistButton">
        <span class="btn-icon">🗑️</span>
        <span class="btn-text">Remove from Whitelist</span>
      </button>
    `;
    document.querySelector('.site-info').appendChild(whitelistInfo);
  }

  /**
   * Show whitelist option for pages that would be blocked
   */
  showWhitelistOption() {
    const whitelistOption = document.createElement('div');
    whitelistOption.className = 'whitelist-option';
    whitelistOption.innerHTML = `
      <button class="whitelist-btn" id="whitelistCurrentButton">
        <span class="btn-icon">✅</span>
        <span class="btn-text">Whitelist This Path</span>
      </button>
      <small style="display: block; margin-top: 5px; color: rgba(255,255,255,0.8);">
        Add exception for this specific page
      </small>
    `;
    
    document.querySelector('.main-action').appendChild(whitelistOption);
  }

  /**
   * Set block button loading state
   */
  setBlockButtonLoading() {
    setButtonLoading(this.elements.blockCurrentButton, '⏳ Adding...');
  }

  /**
   * Show block button success state
   */
  showBlockButtonSuccess() {
    addTemporaryClass(this.elements.blockCurrentButton, 'success', 1500);
    this.elements.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✓</span>
      <span class="btn-text">Blocked!</span>
    `;
    
    setTimeout(() => {
      this.showBlockedState();
    }, 1500);
  }

  /**
   * Set whitelist button loading state
   */
  setWhitelistButtonLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
      setButtonLoading(button, '⏳ Adding...');
    }
  }

  /**
   * Show whitelist button success state
   */
  showWhitelistButtonSuccess(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
      addTemporaryClass(button, 'success', 1500);
      button.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Whitelisted!</span>
      `;
      
      setTimeout(() => {
        button.innerHTML = `
          <span class="btn-icon">✅</span>
          <span class="btn-text">Already Whitelisted</span>
        `;
      }, 1500);
    }
  }

  /**
   * Set remove whitelist button loading state
   */
  setRemoveWhitelistButtonLoading() {
    const button = document.getElementById('removeWhitelistButton');
    if (button) {
      setButtonLoading(button, '⏳ Removing...');
    }
  }

  /**
   * Show remove whitelist button success and reset UI
   */
  showRemoveWhitelistSuccess() {
    const button = document.getElementById('removeWhitelistButton');
    if (button) {
      addTemporaryClass(button, 'success', 1500);
      button.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Removed!</span>
      `;
      
      setTimeout(() => {
        // Remove the whitelist notice
        const whitelistNotice = document.querySelector('.whitelist-notice');
        if (whitelistNotice) {
          whitelistNotice.remove();
        }
        
        // Reset main block button
        this.showNormalState();
      }, 1500);
    }
  }

  /**
   * Show error state on button
   */
  showButtonError(buttonId, errorText) {
    const button = document.getElementById(buttonId) || this.elements.blockCurrentButton;
    button.innerHTML = `
      <span class="btn-icon">❌</span>
      <span class="btn-text">${errorText}</span>
    `;
    
    setTimeout(() => {
      resetButtonLoading(button);
    }, 2000);
  }

  /**
   * Open options page
   */
  openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
    window.close();
  }

  /**
   * Handle page display for invalid URLs
   */
  showInvalidPage() {
    this.elements.currentUrl.textContent = 'Unable to access current page';
    this.elements.blockCurrentButton.disabled = true;
  }
}