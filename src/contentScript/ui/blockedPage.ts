import { ExtensionSettings } from '@shared/types';
import { logger } from '@shared/logger';
import { getWorkHoursStatus, isWithinWorkHours, getFormattedDays } from '@shared/workHoursUtils';

export class BlockedPageUI {
  private settings: ExtensionSettings;
  private isBlocked: boolean = false;
  private originalTitle: string = '';
  private blockOverlay: HTMLElement | null = null;
  private redirectCountdownInterval: number | null = null;
  private currentTimerState: string = 'STOPPED';

  constructor(settings: ExtensionSettings) {
    this.settings = settings;
  }

  /**
   * Inject CSS for blocked page if not already present
   */
  private injectCSS(): void {
    if (document.getElementById('pomoblock-blocked-page-styles')) {
      return; // CSS already injected
    }

    const link = document.createElement('link');
    link.id = 'pomoblock-blocked-page-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('shared/blocked-page.css');
    document.head.appendChild(link);
  }

  /**
   * Update settings
   */
  updateSettings(settings: ExtensionSettings): void {
    this.settings = settings;
  }

  /**
   * Set current timer state for appropriate messaging
   */
  setTimerState(timerState: string): void {
    this.currentTimerState = timerState;
  }

  /**
   * Check if page is currently blocked
   */
  isPageBlocked(): boolean {
    return this.isBlocked;
  }

  /**
   * Create blocked page with overlay approach (preserves history)
   */
  createBlockedPage(isRedirectMode: boolean = false): void {
    logger.log('Creating blocked page overlay', { isRedirectMode, timerState: this.currentTimerState });
    
    // Don't block if already blocked
    if (this.isBlocked) {
      logger.log('Page already blocked, skipping');
      return;
    }

    // Store original title
    this.originalTitle = document.title;
    
    if (isRedirectMode && this.settings.redirectDelay === 0) {
      this.handleRedirect();
      return;
    }
    
    this.createBlockOverlay(isRedirectMode);
    this.isBlocked = true;
    
    // Update page title based on timer state
    this.updatePageTitle();
    
    if (isRedirectMode) {
      this.startRedirectCountdown();
    }
  }

  /**
   * Update page title based on timer state
   */
  private updatePageTitle(): void {
    switch (this.currentTimerState) {
      case 'WORK':
        document.title = '🍅 BLOCKED - Focus Time ';
        break;
      case 'PAUSED':
        document.title = '⏸️ BLOCKED - Timer Paused';
        break;
      default:
        document.title = '🚫 BLOCKED - PomoBlock';
        break;
    }
  }

  /**
   * Remove blocked page overlay
   */
  removeBlockedPage(): void {
    logger.log('Removing blocked page overlay');
    
    // Clear any running countdown interval
    this.clearRedirectCountdown();
    
    // Remove the overlay
    if (this.blockOverlay) {
      // Remove keyboard handler if it exists
      if ((this.blockOverlay as any)._keyHandler) {
        document.removeEventListener('keydown', (this.blockOverlay as any)._keyHandler);
      }
      
      this.blockOverlay.remove();
      this.blockOverlay = null;
    }
    
    if (this.isBlocked) {
      // Restore original title
      document.title = this.originalTitle;
      
      // Restore page scrolling
      document.body.style.overflow = '';
      
      this.isBlocked = false;
      
      // Dispatch event that blocked page was removed
      window.dispatchEvent(new CustomEvent('pomoblock-page-unblocked', {
        detail: { blocked: false }
      }));
      
      logger.log('Blocked page overlay removed and page state restored');
    }
  }

  /**
   * Clear redirect countdown interval
   */
  private clearRedirectCountdown(): void {
    if (this.redirectCountdownInterval !== null) {
      logger.log('Clearing redirect countdown interval');
      clearInterval(this.redirectCountdownInterval);
      this.redirectCountdownInterval = null;
    }
  }

  /**
   * Create the block overlay (doesn't replace entire document)
   */
  private createBlockOverlay(isRedirectMode: boolean = false): void {
    // Remove any existing overlay
    this.removeBlockedPage();

    // Inject CSS if not already present
    this.injectCSS();

    const overlay = document.createElement('div');
    overlay.id = 'pomoblock-blocked-overlay';

    const content = this.generateBlockedContent(isRedirectMode);
    overlay.innerHTML = content;

    // Prevent scrolling on background page
    document.body.style.overflow = 'hidden';

    // Add to page
    document.documentElement.appendChild(overlay);
    this.blockOverlay = overlay;

    // Handle escape key to go back
    this.setupKeyboardHandlers();
    
    // Ensure floating timer remains visible by sending a message to refresh it
    this.ensureFloatingTimerVisible();
    
    logger.log('Block overlay created and added to page');
  }

  /**
   * Generate HTML content for blocked page
   */
  private generateBlockedContent(isRedirectMode: boolean = false): string {
    const currentTime = new Date().toLocaleString();
    const blockedURL = window.location.hostname + window.location.pathname;
    
    // Get appropriate block message and icon based on timer state
    const { message, icon, title } = this.getBlockMessageAndIcon();
    
    // Work hours information
    const workHoursInfo = this.generateWorkHoursInfo();
    
    // Timer-specific information
    const timerInfo = this.generateTimerInfo();
    
    const redirectContent = isRedirectMode ? `
      <div class="redirect-info">
        <h3>🔄 Redirecting in <span id="countdown-seconds">${this.settings.redirectDelay}</span> seconds</h3>
        <p>You will be redirected to: <strong>${this.settings.redirectUrl}</strong></p>
        <div class="progress-container">
          <div class="progress-bar" id="progress-bar"></div>
        </div>
        <button id="cancel-redirect" class="cancel-btn">Cancel Redirect</button>
      </div>
    ` : '';

    const navigationHelp = `
      <div class="blocked-actions">
        <button id="go-back-btn" class="blocked-btn primary">
          <span>← Go Back</span>
        </button>
        <button id="redirect-safe-btn" class="blocked-btn secondary">
          <span>🏠 Safe Page</span>
        </button>
        <button id="close-tab-btn" class="blocked-btn secondary">
          <span>✕ Close Tab</span>
        </button>
      </div>
    `;
    
    return `
      <div class="blocked-content">
        <div class="blocked-icon">${icon}</div>
        <h1 class="blocked-title">${title}</h1>
        <div class="blocked-message">
          ${message}
        </div>
        <div class="blocked-site">
          ${blockedURL}
        </div>
        ${timerInfo}
        ${workHoursInfo}
        ${redirectContent}
        ${navigationHelp}
        <div class="blocked-footer">
          Blocked at: ${currentTime}
        </div>
      </div>
    `;
  }

  /**
   * Get appropriate block message and icon based on timer state
   */
  private getBlockMessageAndIcon(): { message: string; icon: string; title: string } {
    switch (this.currentTimerState) {
      case 'WORK':
        return {
          message: 'This website is blocked during your work session. Stay focused and get things done!',
          icon: '🍅',
          title: 'Focus Time - Site Blocked'
        };
      case 'PAUSED':
        return {
          message: 'This website is blocked. Your pomodoro timer is currently paused.',
          icon: '⏸️',
          title: 'Timer Paused - Site Blocked'
        };
      default:
        return {
          message: 'This website has been blocked by PomoBlock extension.',
          icon: '🚫',
          title: 'Access Blocked'
        };
    }
  }

  /**
   * Generate timer-specific information section
   */
  private generateTimerInfo(): string {
    if (this.currentTimerState === 'STOPPED') {
      return '';
    }

    const currentTime = new Date().toLocaleString();
    
    switch (this.currentTimerState) {
      case 'WORK':
        return `
          <div class="blocked-timer-info">
            <div class="blocked-timer-status">🍅 Pomodoro Timer Active</div>
            <div class="blocked-timer-note">You're currently in a work session. The floating timer remains visible.</div>
          </div>
        `;
      case 'REST':
        return `
          <div class="blocked-timer-info" style="background: rgba(76, 175, 80, 0.2) !important; border-color: rgba(76, 175, 80, 0.4) !important;">
            <div class="blocked-timer-status">☕ Break Time</div>
            <div class="blocked-timer-note">You're currently on a break. The floating timer remains visible.</div>
          </div>
        `;
      case 'PAUSED':
        return `
          <div class="blocked-timer-info" style="background: rgba(255, 152, 0, 0.2) !important; border-color: rgba(255, 152, 0, 0.4) !important;">
            <div class="blocked-timer-status">⏸️ Timer Paused</div>
            <div class="blocked-timer-note">Your pomodoro timer is paused. The floating timer remains visible.</div>
          </div>
        `;
      default:
        return '';
    }
  }

  /**
   * Generate work hours information section
   */
  private generateWorkHoursInfo(): string {
    if (!this.settings.workHours.enabled) {
      return '';
    }

    const workHoursStatus = getWorkHoursStatus(this.settings.workHours);
    const isWithin = isWithinWorkHours(this.settings.workHours);
    const formattedDays = getFormattedDays(this.settings.workHours.days);
    
    const statusIcon = isWithin ? '🟢' : '🔴';
    const statusClass = isWithin ? 'work-hours-active' : 'work-hours-inactive';

    return `
      <div class="work-hours-info ${statusClass}">
        <h4>${statusIcon} Work Hours Status</h4>
        <p class="work-hours-status-text">${workHoursStatus}</p>
        <div class="work-hours-details">
          <p><strong>Schedule:</strong> ${this.settings.workHours.startTime} - ${this.settings.workHours.endTime}</p>
          <p><strong>Days:</strong> ${formattedDays}</p>
        </div>
        ${!isWithin ? '<p class="work-hours-note">💡 This site is only blocked during your work hours</p>' : ''}
      </div>
    `;
  }


  /**
   * Set up keyboard handlers for navigation
   */
  private setupKeyboardHandlers(): void {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        logger.log('Escape key pressed, going back');
        this.goBack();
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    // Set up button click handlers
    const goBackBtn = document.getElementById('go-back-btn');
    const closeTabBtn = document.getElementById('close-tab-btn');
    const redirectSafeBtn = document.getElementById('redirect-safe-btn');

    if (goBackBtn) {
      goBackBtn.addEventListener('click', () => this.goBack());
    }

    if (redirectSafeBtn) {
      redirectSafeBtn.addEventListener('click', () => this.redirectToSafePage());
    }

    if (closeTabBtn) {
      closeTabBtn.addEventListener('click', () => this.attemptCloseTab());
    }

    // Store handler reference for cleanup
    (this.blockOverlay as any)._keyHandler = handleKeyPress;
  }

  /**
   * Go back in browser history
   */
  private goBack(): void {
    logger.log('Going back in history');
    
    // Clear any running countdown before removing the overlay
    this.clearRedirectCountdown();
    
    // Remove the overlay
    this.removeBlockedPage();
    
    // Go back in history
    try {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // No history to go back to, redirect to safe page
        this.redirectToSafePage();
      }
    } catch (error) {
      logger.log('Error going back', (error as Error).message);
      // Fallback: redirect to safe page
      this.redirectToSafePage();
    }
  }

  /**
   * Redirect to a safe/productive page
   */
  private redirectToSafePage(): void {
    logger.log('Redirecting to safe page');
    
    // Clear any running countdown before redirecting
    this.clearRedirectCountdown();
    
    // Remove the overlay
    this.removeBlockedPage();
    
    // Use the user's configured redirect URL, or default to Google
    const safeUrl = this.settings.redirectUrl || 'https://www.google.com';
    
    try {
      window.location.replace(safeUrl);
    } catch (error) {
      logger.log('Error redirecting to safe page', (error as Error).message);
      // Ultimate fallback
      window.location.href = 'https://www.google.com';
    }
  }

  /**
   * Attempt to close current tab with user feedback
   */
  private attemptCloseTab(): void {
    logger.log('Attempting to close tab');
    
    const closeBtn = document.getElementById('close-tab-btn');
    if (closeBtn) {
      // Update button to show we're trying
      closeBtn.innerHTML = `
        <span class="button-icon">⏳</span>
        <span>Closing...</span>
      `;
      closeBtn.style.background = '#666';
    }
    
    // First attempt: try window.close()
    try {
      window.close();
      
      // If we reach here, window.close() didn't work
      setTimeout(() => {
        this.showCloseTabInstructions();
      }, 500);
      
    } catch (error) {
      logger.log('window.close() failed', (error as Error).message);
      this.showCloseTabInstructions();
    }
  }

  /**
   * Show instructions for manually closing the tab
   */
  private showCloseTabInstructions(): void {
    const navigationHelp = document.querySelector('.navigation-help');
    if (navigationHelp) {
      navigationHelp.innerHTML = `
        <h4>🔄 Close Tab Instructions</h4>
        <p>Your browser prevents automatic tab closing for security. Please:</p>
        <div style="text-align: left; margin: 15px 0; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
          <p><strong>Windows/Linux:</strong> Press <kbd>Ctrl</kbd> + <kbd>W</kbd></p>
          <p><strong>Mac:</strong> Press <kbd>Cmd</kbd> + <kbd>W</kbd></p>
          <p><strong>Mobile:</strong> Use your browser's tab management</p>
        </div>
        <div class="navigation-buttons">
          <button id="go-back-btn-2" class="nav-btn">
            <span class="button-icon">←</span>
            <span>Go Back Instead</span>
          </button>
          <button id="redirect-safe-btn-2" class="nav-btn alternative-btn">
            <span class="button-icon">🏠</span>
            <span>Safe Page Instead</span>
          </button>
        </div>
      `;

      // Add event listeners for the new buttons
      const goBackBtn2 = document.getElementById('go-back-btn-2');
      const redirectSafeBtn2 = document.getElementById('redirect-safe-btn-2');

      if (goBackBtn2) {
        goBackBtn2.addEventListener('click', () => this.goBack());
      }

      if (redirectSafeBtn2) {
        redirectSafeBtn2.addEventListener('click', () => this.redirectToSafePage());
      }
    }
  }

  /**
   * Close current tab (deprecated - kept for compatibility)
   */
  private closeTab(): void {
    this.attemptCloseTab();
  }

  /**
   * Start the redirect countdown
   */
  private startRedirectCountdown(): void {
    // Clear any existing countdown first
    this.clearRedirectCountdown();
    
    let secondsLeft = this.settings.redirectDelay;
    const countdownElement = document.getElementById('countdown-seconds');
    const progressBar = document.getElementById('progress-bar');
    const cancelButton = document.getElementById('cancel-redirect');
    
    logger.log('Starting countdown', { redirectUrl: this.settings.redirectUrl, initialSeconds: secondsLeft });
    
    // Update countdown display immediately
    if (countdownElement) {
      countdownElement.textContent = secondsLeft.toString();
    }
    
    // Set up progress bar
    if (progressBar) {
      progressBar.style.animationDuration = `${secondsLeft}s`;
      progressBar.classList.add('running');
    }
    
    // Set up cancel button
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        logger.log('Redirect cancelled by user');
        this.clearRedirectCountdown();
        this.showCancelledMessage();
      });
    }
    
    // Start countdown interval and store reference
    this.redirectCountdownInterval = window.setInterval(() => {
      // Safety check: only continue countdown if page is still blocked
      if (!this.isBlocked) {
        logger.log('Page no longer blocked, stopping countdown');
        this.clearRedirectCountdown();
        return;
      }
      
      secondsLeft--;
      logger.log('Countdown tick', secondsLeft);
      
      if (countdownElement) {
        countdownElement.textContent = secondsLeft.toString();
      }
      
      if (secondsLeft <= 0) {
        logger.log('Countdown finished, initiating redirect');
        this.clearRedirectCountdown();
        
        // Final safety check before redirecting
        if (this.isBlocked) {
          this.handleRedirect();
        } else {
          logger.log('Page no longer blocked, cancelling redirect');
        }
      }
    }, 1000);
    
    logger.log('Redirect countdown started with interval ID:', this.redirectCountdownInterval);
  }

  /**
   * Show cancelled message
   */
  private showCancelledMessage(): void {
    const redirectInfo = document.querySelector('.redirect-info');
    if (redirectInfo) {
      redirectInfo.innerHTML = `
        <div class="redirect-cancelled">
          <h3>🛑 Redirect Cancelled</h3>
          <p>Automatic redirect has been stopped.</p>
          <p style="font-size: 0.9em; opacity: 0.8; margin-top: 10px;">
            Use the back button or navigation buttons below to continue.
          </p>
        </div>
      `;
    }
  }

  /**
   * Handle redirect to specified URL
   */
  private handleRedirect(): void {
    logger.log('handleRedirect called');
    
    // Clear countdown interval first
    this.clearRedirectCountdown();
    
    const redirectUrl = this.settings.redirectUrl;
    logger.log('Redirect URL', redirectUrl);
    
    try {
      // Validate redirect URL
      const url = new URL(redirectUrl);
      logger.log('URL validation passed', url.href);
      
      // Only allow http and https protocols for security
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        logger.log('Protocol is valid, attempting redirect');
        
        // Remove overlay before redirecting
        this.removeBlockedPage();
        
        // Use location.replace to avoid adding to history
        window.location.replace(redirectUrl);
        
      } else {
        logger.log('Invalid protocol, redirecting to Google');
        this.removeBlockedPage();
        window.location.replace('https://www.google.com');
      }
    } catch (error) {
      logger.log('Redirect error', (error as Error).message);
      this.showRedirectFailure(redirectUrl);
    }
  }

  /**
   * Show redirect failure message
   */
  private showRedirectFailure(redirectUrl: string): void {
    const redirectInfo = document.querySelector('.redirect-info');
    if (redirectInfo) {
      redirectInfo.innerHTML = `
        <div class="redirect-failed">
          <h3>🚫 Redirect Failed</h3>
          <p>Automatic redirect failed. Click the link below:</p>
          <p><a href="${redirectUrl}" style="color: #FFD93D; text-decoration: underline;">${redirectUrl}</a></p>
        </div>
      `;
    }
  }


  /**
   * Ensure floating timer remains visible when blocked page is shown
   */
  private ensureFloatingTimerVisible(): void {
    // Send a message to notify that the blocked page is displayed
    // This allows other components to ensure they remain visible
    try {
      chrome.runtime.sendMessage({ 
        type: 'BLOCKED_PAGE_DISPLAYED',
        timestamp: Date.now()
      });
    } catch (error) {
      logger.log('Error sending blocked page displayed message:', error);
    }
    
    // Also dispatch a custom event for the floating timer
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pomoblock-page-blocked', {
        detail: { 
          blocked: true,
          timerState: this.currentTimerState
        }
      }));
    }, 100);
  }

  /**
   * Clean up when component is destroyed
   */
  cleanup(): void {
    logger.log('Cleaning up BlockedPageUI');
    
    // Clear redirect countdown
    this.clearRedirectCountdown();
    
    // Remove blocked page overlay
    this.removeBlockedPage();
    
    logger.log('BlockedPageUI cleanup completed');
  }
}