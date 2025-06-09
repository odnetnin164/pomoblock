// src/popup/index.ts
import './popup.css';
import { getBlockedWebsites, getWhitelistedPaths } from '@shared/storage';
import { StatusDisplay } from './components/StatusDisplay';
import { SiteManager } from './components/SiteManager';
import { PomodoroControl } from './components/PomodoroControl';
import { UI_CONFIG } from '@shared/constants';

class PopupManager {
  private statusDisplay: StatusDisplay;
  private siteManager: SiteManager;
  private pomodoroControl: PomodoroControl;
  private statusUpdateInterval: number | null = null;
  
  // DOM Elements
  private currentUrlElement: HTMLElement;
  private blockTargetElement: HTMLElement;
  private blockCurrentButton: HTMLButtonElement;
  private manageButton: HTMLButtonElement;
  private optionsButton: HTMLButtonElement;
  private historyButton: HTMLButtonElement;

  constructor() {
    this.statusDisplay = new StatusDisplay('statusDisplay', 'siteCount');
    this.siteManager = new SiteManager();
    this.pomodoroControl = new PomodoroControl('pomodoroContainer');
    
    // Get DOM elements
    this.currentUrlElement = document.getElementById('currentUrl')!;
    this.blockTargetElement = document.getElementById('blockTarget')!;
    this.blockCurrentButton = document.getElementById('blockCurrentButton') as HTMLButtonElement;
    this.manageButton = document.getElementById('manageButton') as HTMLButtonElement;
    this.optionsButton = document.getElementById('optionsButton') as HTMLButtonElement;
    this.historyButton = document.getElementById('historyButton') as HTMLButtonElement;

    this.init();
  }

  /**
   * Initialize the popup
   */
  private async init(): Promise<void> {
    // Load initial data
    await this.loadSiteCount();
    await this.getCurrentTabInfo();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check current site status and timer status
    await this.checkCurrentSiteStatus();
    
    // Start periodic status updates
    this.startStatusUpdates();
  }

  /**
   * Start periodic updates for integrated status
   */
  private startStatusUpdates(): void {
    // Check status every 2 seconds for real-time updates
    this.statusUpdateInterval = window.setInterval(() => {
      this.updateIntegratedStatus();
    }, 2000);
  }

  /**
   * Stop status updates
   */
  private stopStatusUpdates(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  /**
   * Update integrated status (timer + blocking)
   */
  private async updateIntegratedStatus(): Promise<void> {
    try {
      // Get current timer status
      const timerResponse = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATUS' });
      const timerStatus = timerResponse.status;
      
      if (timerStatus) {
        // Update blocking UI based on timer state
        this.updateBlockingBasedOnTimer(timerStatus.state);
      }
    } catch (error) {
      console.error('Error updating integrated status:', error);
    }
  }

  /**
   * Update blocking UI based on timer state
   */
  private updateBlockingBasedOnTimer(timerState: string): void {
    const blockTarget = this.siteManager.getBlockTarget();
    
    if (timerState === 'WORK' && blockTarget) {
      // Timer is in work period - show that blocking is active
      this.blockCurrentButton.classList.add('timer-blocked');
      this.blockCurrentButton.innerHTML = `
        <span class="btn-icon">🍅</span>
        <span class="btn-text">Blocked by Work Timer</span>
      `;
      this.blockCurrentButton.disabled = true;
      
      // Add timer blocking notice
      this.addTimerBlockingNotice('This site is blocked during your work session. Stay focused! 🍅');
      
    } else if (timerState === 'REST' && blockTarget) {
      // Timer is in rest period - show that blocking is disabled
      this.blockCurrentButton.classList.remove('timer-blocked');
      this.blockCurrentButton.classList.add('timer-rest');
      this.blockCurrentButton.innerHTML = `
        <span class="btn-icon">☕</span>
        <span class="btn-text">Unblocked - Break Time</span>
      `;
      this.blockCurrentButton.disabled = true;
      
      // Add rest period notice
      this.addTimerBlockingNotice('Enjoy your break! All sites are accessible during rest periods. ☕');
      
    } else {
      // Timer is stopped or paused - use normal blocking logic
      this.blockCurrentButton.classList.remove('timer-blocked', 'timer-rest');
      this.removeTimerBlockingNotice();
      
      // Check regular blocking status
      this.checkCurrentSiteStatus();
    }
  }

  /**
   * Add timer blocking notice
   */
  private addTimerBlockingNotice(message: string): void {
    // Remove existing notice
    this.removeTimerBlockingNotice();
    
    const timerNotice = document.createElement('div');
    timerNotice.className = 'timer-blocking-notice';
    timerNotice.innerHTML = `
      <small style="color: #FFD93D; margin-top: 10px; display: block; font-weight: 600;">
        ${message}
      </small>
    `;
    document.querySelector('.site-info')?.appendChild(timerNotice);
  }

  /**
   * Remove timer blocking notice
   */
  private removeTimerBlockingNotice(): void {
    const timerNotice = document.querySelector('.timer-blocking-notice');
    if (timerNotice) {
      timerNotice.remove();
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.blockCurrentButton.addEventListener('click', () => this.handleBlockAction());
    this.manageButton.addEventListener('click', () => this.openOptionsPage());
    this.optionsButton.addEventListener('click', () => this.openOptionsPage());
    this.historyButton.addEventListener('click', () => this.openHistoryPage());

    // Clean up intervals when popup closes
    window.addEventListener('beforeunload', () => {
      this.stopStatusUpdates();
      if (this.pomodoroControl) {
        this.pomodoroControl.destroy();
      }
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopStatusUpdates();
      } else {
        this.startStatusUpdates();
        this.updateIntegratedStatus(); // Immediate update when becoming visible
      }
    });
  }

  /**
   * Load and display site counts
   */
  private async loadSiteCount(): Promise<void> {
    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);
      
      this.statusDisplay.updateSiteCount(blockedWebsites.length, whitelistedPaths.length);
    } catch (error) {
      console.error('Error loading site count:', error);
    }
  }

  /**
   * Get current tab information
   */
  private async getCurrentTabInfo(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs[0]?.url) {
        this.siteManager.setCurrentTab(tabs[0].url);
        this.displayCurrentSite();
      } else {
        this.currentUrlElement.textContent = 'Unable to access current page';
        this.blockCurrentButton.disabled = true;
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      this.currentUrlElement.textContent = 'Error accessing current page';
      this.blockCurrentButton.disabled = true;
    }
  }

  /**
   * Display current site information
   */
  private displayCurrentSite(): void {
    const siteInfo = this.siteManager.getCurrentSiteInfo();
    const blockTarget = this.siteManager.getBlockTarget();
    
    if (!siteInfo || !blockTarget) {
      this.currentUrlElement.textContent = 'Cannot block this page';
      this.blockTargetElement.textContent = '';
      this.blockCurrentButton.disabled = true;
      return;
    }

    // Display current URL
    this.currentUrlElement.textContent = siteInfo.hostname + 
      (siteInfo.pathname !== '/' ? siteInfo.pathname : '');
    
    // Display block target
    this.blockTargetElement.textContent = `Will block: ${blockTarget.target}`;
    
    // Add special styling for certain sites
    if (blockTarget.isSpecialSite) {
      document.querySelector('.site-info')?.classList.add('special-site');
    }
  }

  /**
   * Check current site status and update UI
   */
  private async checkCurrentSiteStatus(): Promise<void> {
    const blockTarget = this.siteManager.getBlockTarget();
    if (!blockTarget) return;

    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);

      const isBlocked = blockedWebsites.includes(blockTarget.target);
      const isWhitelisted = this.siteManager.checkIfWhitelisted(whitelistedPaths);
      const wouldBeBlocked = this.siteManager.checkIfWouldBeBlocked(blockedWebsites);

      // Update site manager status
      this.siteManager.updateBlockTargetStatus(isBlocked, isWhitelisted);

      // Update UI based on status
      this.updateButtonState(isBlocked, isWhitelisted, wouldBeBlocked, whitelistedPaths);
      
    } catch (error) {
      console.error('Error checking site status:', error);
    }
  }

  /**
   * Update button state based on current site status
   */
  private updateButtonState(
    isBlocked: boolean, 
    isWhitelisted: boolean, 
    wouldBeBlocked: boolean,
    whitelistedPaths: string[]
  ): void {
    if (isWhitelisted) {
      this.showWhitelistedState(whitelistedPaths);
    } else if (isBlocked) {
      this.showBlockedState();
    } else if (wouldBeBlocked && this.siteManager.getBlockTarget()?.target.includes('/')) {
      this.showWhitelistOption();
    } else {
      this.showNormalState();
    }
  }

  /**
   * Show whitelisted state
   */
  private showWhitelistedState(whitelistedPaths: string[]): void {
    this.blockCurrentButton.classList.add('already-blocked');
    this.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✅</span>
      <span class="btn-text">Whitelisted</span>
    `;
    this.blockCurrentButton.disabled = true;
    
    // Add whitelist info and remove button
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
    
    document.querySelector('.site-info')?.appendChild(whitelistInfo);
    
    // Add event listener for remove button
    document.getElementById('removeWhitelistButton')?.addEventListener('click', () => {
      this.removeFromWhitelist(whitelistedPaths);
    });
  }

  /**
   * Show blocked state
   */
  private showBlockedState(): void {
    this.blockCurrentButton.classList.add('already-blocked');
    this.blockCurrentButton.innerHTML = `
      <span class="btn-icon">✓</span>
      <span class="btn-text">Already Blocked</span>
    `;
    this.blockCurrentButton.disabled = true;
  }

  /**
   * Show whitelist option for pages that would be blocked
   */
  private showWhitelistOption(): void {
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
    
    document.querySelector('.main-action')?.appendChild(whitelistOption);
    
    // Add event listener for whitelist button
    document.getElementById('whitelistCurrentButton')?.addEventListener('click', () => {
      this.whitelistCurrentPath();
    });
  }

  /**
   * Show normal state (ready to block)
   */
  private showNormalState(): void {
    this.blockCurrentButton.innerHTML = `
      <span class="btn-icon">🚫</span>
      <span class="btn-text">Block This Page</span>
    `;
    this.blockCurrentButton.disabled = false;
  }

  /**
   * Handle the main block action
   */
  private async handleBlockAction(): Promise<void> {
    const blockTarget = this.siteManager.getBlockTarget();
    if (!blockTarget || blockTarget.isBlocked || blockTarget.isWhitelisted) return;

    await this.blockCurrentSite();
  }

  /**
   * Block the current site
   */
  private async blockCurrentSite(): Promise<void> {
    this.blockCurrentButton.disabled = true;
    this.blockCurrentButton.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Adding...</span>
    `;

    try {
      await this.siteManager.addToBlockedList();
      
      // Success animation
      this.blockCurrentButton.classList.add('success');
      this.blockCurrentButton.innerHTML = `
        <span class="btn-icon">✓</span>
        <span class="btn-text">Blocked!</span>
      `;
      
      // Update site count
      await this.loadSiteCount();
      
      // Update button state after delay
      setTimeout(() => {
        this.blockCurrentButton.classList.remove('success');
        this.showBlockedState();
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
      
    } catch (error) {
      console.error('Error blocking site:', error);
      this.blockCurrentButton.innerHTML = `
        <span class="btn-icon">❌</span>
        <span class="btn-text">Error</span>
      `;
      
      setTimeout(() => {
        this.showNormalState();
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
    }
  }

  /**
   * Whitelist current path
   */
  private async whitelistCurrentPath(): Promise<void> {
    const whitelistButton = document.getElementById('whitelistCurrentButton') as HTMLButtonElement;
    if (!whitelistButton) return;

    whitelistButton.disabled = true;
    whitelistButton.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Adding...</span>
    `;

    try {
      await this.siteManager.addToWhitelist();
      
      // Success animation
      whitelistButton.classList.add('success');
      whitelistButton.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Whitelisted!</span>
      `;
      
      // Update site count
      await this.loadSiteCount();
      
      setTimeout(() => {
        whitelistButton.innerHTML = `
          <span class="btn-icon">✅</span>
          <span class="btn-text">Already Whitelisted</span>
        `;
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
      
    } catch (error) {
      console.error('Error whitelisting path:', error);
      whitelistButton.innerHTML = `
        <span class="btn-icon">❌</span>
        <span class="btn-text">Error</span>
      `;
      
      setTimeout(() => {
        whitelistButton.disabled = false;
        whitelistButton.innerHTML = `
          <span class="btn-icon">✅</span>
          <span class="btn-text">Whitelist This Path</span>
        `;
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
    }
  }

  /**
   * Remove current page from whitelist
   */
  private async removeFromWhitelist(whitelistedPaths: string[]): Promise<void> {
    const removeButton = document.getElementById('removeWhitelistButton') as HTMLButtonElement;
    if (!removeButton) return;

    removeButton.disabled = true;
    removeButton.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Removing...</span>
    `;

    try {
      await this.siteManager.removeFromWhitelist(whitelistedPaths);
      
      // Success animation
      removeButton.classList.add('success');
      removeButton.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Removed!</span>
      `;
      
      // Update site count
      await this.loadSiteCount();
      
      setTimeout(() => {
        // Remove whitelist notice and reset main button
        const whitelistNotice = document.querySelector('.whitelist-notice');
        whitelistNotice?.remove();
        
        this.showNormalState();
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
      
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      removeButton.innerHTML = `
        <span class="btn-icon">❌</span>
        <span class="btn-text">Error</span>
      `;
      
      setTimeout(() => {
        removeButton.disabled = false;
        removeButton.innerHTML = `
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">Remove from Whitelist</span>
        `;
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
    }
  }

  /**
   * Open options page
   */
  private openOptionsPage(): void {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
    window.close();
  }

  /**
   * Open history page
   */
  private openHistoryPage(): void {
    chrome.tabs.create({
      url: chrome.runtime.getURL('history.html')
    });
    window.close();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});