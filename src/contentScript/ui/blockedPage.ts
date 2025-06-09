import { ExtensionSettings } from '@shared/types';
import { logger } from '@shared/logger';
import { getWorkHoursStatus, isWithinWorkHours, getFormattedDays } from '@shared/workHoursUtils';

export class BlockedPageUI {
  private settings: ExtensionSettings;
  private isBlocked: boolean = false;
  private originalTitle: string = '';
  private blockOverlay: HTMLElement | null = null;
  private redirectCountdownInterval: number | null = null;

  constructor(settings: ExtensionSettings) {
    this.settings = settings;
  }

  /**
   * Update settings
   */
  updateSettings(settings: ExtensionSettings): void {
    this.settings = settings;
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
    logger.log('Creating blocked page overlay', { isRedirectMode });
    
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
    
    // Update page title
    document.title = '🚫 Site Blocked - PomoBlock';
    
    if (isRedirectMode) {
      this.startRedirectCountdown();
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

    const overlay = document.createElement('div');
    overlay.id = 'pomoblock-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      z-index: 2147483647 !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      color: white !important;
      overflow: auto !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;

    const content = this.generateBlockedContent(isRedirectMode);
    overlay.innerHTML = content;

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = this.generateCSS();
    overlay.appendChild(styleElement);

    // Prevent scrolling on background page
    document.body.style.overflow = 'hidden';

    // Add to page
    document.documentElement.appendChild(overlay);
    this.blockOverlay = overlay;

    // Handle escape key to go back
    this.setupKeyboardHandlers();
    
    logger.log('Block overlay created and added to page');
  }

  /**
   * Generate HTML content for blocked page
   */
  private generateBlockedContent(isRedirectMode: boolean = false): string {
    const currentTime = new Date().toLocaleString();
    const blockedURL = window.location.hostname + window.location.pathname;
    
    // Work hours information
    const workHoursInfo = this.generateWorkHoursInfo();
    
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
      <div class="navigation-help">
        <h4>🔙 Want to navigate away?</h4>
        <p>Press your browser's back button, press <kbd>Esc</kbd>, or use the buttons below:</p>
        <div class="navigation-buttons">
          <button id="go-back-btn" class="nav-btn">
            <span class="button-icon">←</span>
            <span>Go Back</span>
          </button>
          <button id="redirect-safe-btn" class="nav-btn alternative-btn">
            <span class="button-icon">🏠</span>
            <span>Safe Page</span>
          </button>
          <button id="close-tab-btn" class="nav-btn close-btn">
            <span class="button-icon">✕</span>
            <span>Close Tab</span>
          </button>
        </div>
      </div>
    `;
    
    return `
      <div class="blocked-container">
        <div class="blocked-icon">🚫</div>
        <h1>Access Blocked</h1>
        <div class="blocked-message">
          This website has been blocked by PomoBlock extension.
        </div>
        <div class="blocked-url">
          ${blockedURL}
        </div>
        ${workHoursInfo}
        ${redirectContent}
        ${navigationHelp}
        <div class="blocked-time">
          Blocked at: ${currentTime}
        </div>
      </div>
    `;
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
   * Generate CSS styles for blocked page
   */
  private generateCSS(): string {
    return `
      /* Reset and base styles with high specificity */
      #pomoblock-overlay * {
        box-sizing: border-box !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      }
      
      .blocked-container {
        text-align: center !important;
        background: rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
        border-radius: 20px !important;
        padding: 60px 40px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        max-width: 700px !important;
        margin: 20px !important;
        color: white !important;
      }
      
      .blocked-icon {
        font-size: 80px !important;
        margin-bottom: 30px !important;
        color: #ff6b6b !important;
        animation: pulse 2s infinite !important;
      }
      
      #pomoblock-overlay h1 {
        font-size: 2.5em !important;
        margin-bottom: 20px !important;
        color: white !important;
        font-weight: 600 !important;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3) !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      }
      
      .blocked-message {
        font-size: 1.2em !important;
        color: rgba(255, 255, 255, 0.9) !important;
        margin-bottom: 30px !important;
        line-height: 1.6 !important;
      }
      
      .blocked-url {
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 10px !important;
        padding: 15px !important;
        margin: 20px 0 !important;
        color: #ffd93d !important;
        font-family: 'Courier New', monospace !important;
        font-size: 1.1em !important;
        word-break: break-all !important;
      }

      /* Work Hours Info Styles */
      .work-hours-info {
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 12px !important;
        padding: 20px !important;
        margin: 25px 0 !important;
        border: 2px solid rgba(255, 255, 255, 0.2) !important;
        text-align: left !important;
      }

      .work-hours-info.work-hours-active {
        background: rgba(76, 175, 80, 0.2) !important;
        border-color: rgba(76, 175, 80, 0.5) !important;
      }

      .work-hours-info.work-hours-inactive {
        background: rgba(255, 152, 0, 0.2) !important;
        border-color: rgba(255, 152, 0, 0.5) !important;
      }

      .work-hours-info h4 {
        font-size: 1.2em !important;
        margin-bottom: 10px !important;
        color: white !important;
        font-weight: 600 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .work-hours-status-text {
        font-size: 1em !important;
        color: rgba(255, 255, 255, 0.9) !important;
        margin-bottom: 15px !important;
        font-weight: 500 !important;
      }

      .work-hours-details {
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 8px !important;
        padding: 12px !important;
        margin-bottom: 10px !important;
      }

      .work-hours-details p {
        margin: 5px 0 !important;
        font-size: 0.9em !important;
        color: rgba(255, 255, 255, 0.8) !important;
      }

      .work-hours-note {
        font-size: 0.9em !important;
        color: #FFD93D !important;
        font-weight: 500 !important;
        margin-top: 10px !important;
        padding: 8px 12px !important;
        background: rgba(255, 217, 61, 0.2) !important;
        border-radius: 6px !important;
        border: 1px solid rgba(255, 217, 61, 0.3) !important;
      }
      
      .redirect-info {
        background: rgba(255, 152, 0, 0.2) !important;
        border: 2px solid rgba(255, 152, 0, 0.5) !important;
        border-radius: 15px !important;
        padding: 25px !important;
        margin: 25px 0 !important;
        color: white !important;
      }
      
      .redirect-info h3 {
        font-size: 1.3em !important;
        margin-bottom: 15px !important;
        color: #FFD93D !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      }
      
      .redirect-info p {
        margin-bottom: 15px !important;
        font-size: 1em !important;
        color: rgba(255, 255, 255, 0.9) !important;
      }
      
      #countdown-seconds {
        font-size: 1.2em !important;
        font-weight: bold !important;
        color: #FFD93D !important;
        background: rgba(255, 217, 61, 0.2) !important;
        padding: 2px 8px !important;
        border-radius: 5px !important;
      }
      
      .progress-container {
        width: 100% !important;
        height: 8px !important;
        background: rgba(255, 255, 255, 0.2) !important;
        border-radius: 4px !important;
        margin: 20px 0 !important;
        overflow: hidden !important;
      }
      
      .progress-bar {
        height: 100% !important;
        background: linear-gradient(90deg, #FFD93D 0%, #FF9800 100%) !important;
        border-radius: 4px !important;
        width: 100% !important;
        transform: translateX(-100%) !important;
        transition: transform 0.1s linear !important;
      }
      
      .progress-bar.running {
        animation: progressAnimation linear forwards !important;
      }
      
      @keyframes progressAnimation {
        from { transform: translateX(-100%) !important; }
        to { transform: translateX(0%) !important; }
      }
      
      .navigation-help {
        background: rgba(76, 175, 80, 0.1) !important;
        border: 2px solid rgba(76, 175, 80, 0.3) !important;
        border-radius: 15px !important;
        padding: 25px !important;
        margin: 25px 0 !important;
        color: white !important;
      }
      
      .navigation-help h4 {
        font-size: 1.2em !important;
        margin-bottom: 15px !important;
        color: #4CAF50 !important;
        font-weight: 600 !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      }
      
      .navigation-help p {
        margin-bottom: 20px !important;
        color: rgba(255, 255, 255, 0.9) !important;
        font-size: 0.95em !important;
        line-height: 1.5 !important;
      }
      
      #pomoblock-overlay kbd {
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 4px !important;
        padding: 3px 8px !important;
        font-size: 0.85em !important;
        font-family: 'Courier New', monospace !important;
        color: #FFD93D !important;
        font-weight: bold !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }
      
      .navigation-buttons {
        display: flex !important;
        gap: 15px !important;
        justify-content: center !important;
        flex-wrap: wrap !important;
        margin-top: 20px !important;
      }
      
      /* High specificity button styles to override site CSS */
      #pomoblock-overlay .navigation-buttons .nav-btn,
      #pomoblock-overlay .nav-btn,
      #pomoblock-overlay button.nav-btn {
        /* Reset all potentially inherited styles */
        all: unset !important;
        
        /* Apply our specific styles */
        background: #4CAF50 !important;
        color: white !important;
        border: none !important;
        border-radius: 10px !important;
        padding: 14px 24px !important;
        font-size: 1em !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        min-width: 140px !important;
        justify-content: center !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        border: 2px solid transparent !important;
        box-sizing: border-box !important;
        text-decoration: none !important;
        outline: none !important;
        
        /* Override common site-specific properties */
        height: auto !important;
        line-height: normal !important;
        width: auto !important;
        max-width: none !important;
        min-height: auto !important;
        white-space: nowrap !important;
        text-overflow: clip !important;
        overflow: visible !important;
        text-align: center !important;
        vertical-align: baseline !important;
        margin: 0 !important;
        position: relative !important;
        z-index: auto !important;
        transform: none !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      #pomoblock-overlay .navigation-buttons .nav-btn:hover,
      #pomoblock-overlay .nav-btn:hover,
      #pomoblock-overlay button.nav-btn:hover {
        background: #45a049 !important;
        transform: translateY(-3px) !important;
        box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      
      #pomoblock-overlay .navigation-buttons .nav-btn:active,
      #pomoblock-overlay .nav-btn:active,
      #pomoblock-overlay button.nav-btn:active {
        transform: translateY(-1px) !important;
        box-shadow: 0 3px 10px rgba(76, 175, 80, 0.3) !important;
      }
      
      #pomoblock-overlay .close-btn {
        background: #f44336 !important;
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.3) !important;
      }
      
      #pomoblock-overlay .close-btn:hover {
        background: #da190b !important;
        box-shadow: 0 6px 20px rgba(244, 67, 54, 0.4) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      
      #pomoblock-overlay .close-btn:active {
        box-shadow: 0 3px 10px rgba(244, 67, 54, 0.3) !important;
      }
      
      #pomoblock-overlay .alternative-btn {
        background: #FF9800 !important;
        box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3) !important;
      }
      
      #pomoblock-overlay .alternative-btn:hover {
        background: #f57c00 !important;
        box-shadow: 0 6px 20px rgba(255, 152, 0, 0.4) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      
      #pomoblock-overlay .alternative-btn:active {
        box-shadow: 0 3px 10px rgba(255, 152, 0, 0.3) !important;
      }
      
      #pomoblock-overlay .cancel-btn {
        background: rgba(244, 67, 54, 0.8) !important;
        color: white !important;
        border: 2px solid #f44336 !important;
        padding: 12px 24px !important;
        border-radius: 10px !important;
        font-size: 0.95em !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        margin-top: 15px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.3) !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        height: auto !important;
        line-height: normal !important;
        width: auto !important;
        display: inline-block !important;
      }
      
      #pomoblock-overlay .cancel-btn:hover {
        background: #f44336 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(244, 67, 54, 0.4) !important;
      }
      
      .blocked-time {
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 0.9em !important;
        margin-top: 20px !important;
      }
      
      .button-icon {
        font-size: 1.1em !important;
        font-weight: bold !important;
        display: inline-block !important;
      }
      
      @keyframes pulse {
        0% { transform: scale(1) !important; }
        50% { transform: scale(1.1) !important; }
        100% { transform: scale(1) !important; }
      }
      
      @media (max-width: 600px) {
        .blocked-container {
          padding: 40px 20px !important;
          margin: 10px !important;
          max-width: 95% !important;
        }
        
        #pomoblock-overlay h1 {
          font-size: 2em !important;
        }
        
        .blocked-icon {
          font-size: 60px !important;
        }
        
        .navigation-buttons {
          flex-direction: column !important;
          align-items: center !important;
        }
        
        #pomoblock-overlay .nav-btn {
          width: 100% !important;
          max-width: 280px !important;
          margin: 5px 0 !important;
        }
        
        .navigation-help,
        .work-hours-info {
          padding: 20px !important;
        }
      }
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