/**
 * Blocked page generation and management
 */

import { debugLog, debugError } from '../../shared/utils/debug.js';
import { determineWhitelistTarget } from '../../shared/utils/url-utils.js';
import { getWhitelistLabel } from '../../shared/utils/site-detection.js';

export class BlockedPageGenerator {
  constructor() {
    this.countdownInterval = null;
  }

  /**
   * Create blocked page with redirect countdown
   * @param {Object} settings - Extension settings
   */
  createBlockedPageWithRedirect(settings) {
    debugLog('Creating blocked page with redirect countdown');
    
    const redirectUrl = settings.redirectUrl || 'https://www.google.com';
    const redirectDelay = settings.redirectDelay || 3;
    
    debugLog('Redirect URL', redirectUrl);
    debugLog('Redirect delay', redirectDelay);
    
    // If delay is 0, redirect immediately
    if (redirectDelay === 0) {
      this.handleRedirect(redirectUrl);
      return;
    }
    
    const blockedPage = this.generateHTML(true, redirectUrl, redirectDelay);
    const style = this.generateCSS();
    
    // Clear the entire document
    document.documentElement.innerHTML = blockedPage;
    
    // Inject the styles
    const head = document.head || document.getElementsByTagName("head")[0];
    head.insertAdjacentHTML("beforeend", style);
    
    // Start countdown
    this.startRedirectCountdown(redirectUrl, redirectDelay);
  }

  /**
   * Create static blocked page
   */
  createBlockedPage() {
    debugLog('Creating blocked page');
    
    const blockedPage = this.generateHTML(false);
    const style = this.generateCSS();
    
    // Clear the entire document
    document.documentElement.innerHTML = blockedPage;
    
    // Inject the styles
    const head = document.head || document.getElementsByTagName("head")[0];
    head.insertAdjacentHTML("beforeend", style);
  }

  /**
   * Handle redirect to specified URL
   * @param {string} redirectUrl - URL to redirect to
   */
  handleRedirect(redirectUrl) {
    debugLog('handleRedirect called');
    debugLog('Redirect URL', redirectUrl);
    
    try {
      // Validate redirect URL
      const url = new URL(redirectUrl);
      debugLog('URL validation passed', url.href);
      
      // Only allow http and https protocols for security
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        debugLog('Protocol is valid, attempting immediate redirect');
        
        // IMMEDIATE REDIRECT - No DOM manipulation needed
        debugLog('Attempting window.location.replace');
        window.location.replace(redirectUrl);
        
        // Backup methods
        setTimeout(() => {
          debugLog('Backup: window.location.href');
          window.location.href = redirectUrl;
        }, 50);
        
        setTimeout(() => {
          debugLog('Backup: window.location.assign');
          window.location.assign(redirectUrl);
        }, 100);
        
        // Try parent/top windows
        setTimeout(() => {
          debugLog('Backup: top.location');
          try {
            if (window.top && window.top !== window) {
              window.top.location.href = redirectUrl;
            }
            if (window.parent && window.parent !== window) {
              window.parent.location.href = redirectUrl;
            }
          } catch (e) {
            debugLog('Parent/top redirect failed', e.message);
          }
        }, 150);
        
        // If redirect fails, show failure message
        setTimeout(() => {
          debugLog('Redirect failed - still on original page');
          this.showRedirectFailure(redirectUrl);
        }, 1000);
        
      } else {
        debugLog('Invalid protocol, redirecting to Google');
        window.location.replace('https://www.google.com');
      }
    } catch (error) {
      debugError('Redirect error', error);
      this.showRedirectFailure(redirectUrl);
    }
  }

  /**
   * Start the redirect countdown
   * @param {string} redirectUrl - URL to redirect to
   * @param {number} initialSeconds - Initial countdown seconds
   */
  startRedirectCountdown(redirectUrl, initialSeconds) {
    let secondsLeft = initialSeconds;
    const countdownElement = document.getElementById('countdown-seconds');
    const progressBar = document.getElementById('progress-bar');
    const cancelButton = document.getElementById('cancel-redirect');
    
    debugLog('Starting countdown', { redirectUrl, initialSeconds });
    
    // Update countdown display immediately
    if (countdownElement) {
      countdownElement.textContent = secondsLeft;
    }
    
    // Set up progress bar
    if (progressBar) {
      progressBar.style.animationDuration = `${initialSeconds}s`;
      progressBar.classList.add('running');
    }
    
    // Set up cancel button
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        debugLog('Redirect cancelled by user');
        clearInterval(this.countdownInterval);
        this.showCancelledMessage();
      });
    }
    
    // Start countdown interval
    this.countdownInterval = setInterval(() => {
      secondsLeft--;
      debugLog('Countdown tick', secondsLeft);
      
      if (countdownElement) {
        countdownElement.textContent = secondsLeft;
      }
      
      if (secondsLeft <= 0) {
        clearInterval(this.countdownInterval);
        debugLog('Countdown finished, redirecting');
        this.handleRedirect(redirectUrl);
      }
    }, 1000);
  }

  /**
   * Show cancelled message
   */
  showCancelledMessage() {
    const redirectInfo = document.querySelector('.redirect-info');
    if (redirectInfo) {
      redirectInfo.innerHTML = `
        <div class="redirect-cancelled">
          <h3>🛑 Redirect Cancelled</h3>
          <p>You chose to stay on the blocked page.</p>
          <p style="font-size: 0.9em; opacity: 0.8; margin-top: 10px;">
            Close this tab or navigate away manually.
          </p>
        </div>
      `;
    }
  }

  /**
   * Show redirect failure message
   * @param {string} redirectUrl - Failed redirect URL
   */
  showRedirectFailure(redirectUrl) {
    const createFailureMessage = () => {
      const messageDiv = document.createElement('div');
      messageDiv.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                    background: #ff4757; display: flex; align-items: center; 
                    justify-content: center; color: white; font-size: 18px; 
                    font-family: Arial; z-index: 999999; text-align: center;">
          <div>
            <h1>🚫 Redirect Failed</h1>
            <p>This website is blocked, but automatic redirect failed.</p>
            <p>Redirect target: <strong>${redirectUrl}</strong></p>
            <p><a href="${redirectUrl}" style="color: #fff; text-decoration: underline;">Click here to go manually</a></p>
            <div style="margin-top: 20px; font-size: 12px;">
              <p>Possible causes:</p>
              <p>• Browser security policy</p>
              <p>• Website content security policy</p>
              <p>• Site blocking redirects</p>
            </div>
          </div>
        </div>
      `;
      
      // Try different ways to add it to the page
      if (document.body) {
        debugLog('Adding failure message to body');
        document.body.appendChild(messageDiv);
      } else if (document.documentElement) {
        debugLog('Adding failure message to documentElement');
        document.documentElement.appendChild(messageDiv);
      } else {
        debugLog('No DOM available for failure message');
        setTimeout(createFailureMessage, 100);
      }
    };
    
    createFailureMessage();
  }

  /**
   * Generate HTML for blocked page
   * @param {boolean} isRedirectMode - Whether to show redirect UI
   * @param {string} redirectUrl - Redirect URL
   * @param {number} redirectDelay - Redirect delay
   * @returns {string} HTML string
   */
  generateHTML(isRedirectMode = false, redirectUrl = '', redirectDelay = 0) {
    const currentTime = new Date().toLocaleString();
    const blockedURL = window.location.hostname + window.location.pathname;
    
    const redirectContent = isRedirectMode ? `
      <div class="redirect-info">
        <h3>🔄 Redirecting in <span id="countdown-seconds">${redirectDelay}</span> seconds</h3>
        <p>You will be redirected to: <strong>${redirectUrl}</strong></p>
        <div class="progress-container">
          <div class="progress-bar" id="progress-bar"></div>
        </div>
        <button id="cancel-redirect" class="cancel-btn">Cancel Redirect</button>
      </div>
    ` : '';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Site Blocked - PomoBlock</title>
      </head>
      <body>
        <div class="blocked-container">
          <div class="blocked-icon">🚫</div>
          <h1>Access Blocked</h1>
          <div class="blocked-message">
            This website has been blocked by PomoBlock extension.
          </div>
          <div class="blocked-url">
            ${blockedURL}
          </div>
          ${redirectContent}
          <div class="blocked-time">
            Blocked at: ${currentTime}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate CSS styles for blocked page
   * @returns {string} CSS string
   */
  generateCSS() {
    return `
      <style>
      * {
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      
      body {
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        height: 100vh !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        overflow: hidden !important;
      }
      
      .blocked-container {
        text-align: center !important;
        background: rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
        border-radius: 20px !important;
        padding: 60px 40px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        max-width: 600px !important;
        margin: 20px !important;
      }
      
      .blocked-icon {
        font-size: 80px !important;
        margin-bottom: 30px !important;
        color: #ff6b6b !important;
        animation: pulse 2s infinite !important;
      }
      
      h1 {
        font-size: 2.5em !important;
        margin-bottom: 20px !important;
        color: white !important;
        font-weight: 600 !important;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3) !important;
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
        from { transform: translateX(-100%); }
        to { transform: translateX(0%); }
      }
      
      .cancel-btn {
        background: rgba(244, 67, 54, 0.8) !important;
        color: white !important;
        border: 2px solid #f44336 !important;
        padding: 10px 20px !important;
        border-radius: 8px !important;
        font-size: 0.9em !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        margin-top: 15px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      
      .cancel-btn:hover {
        background: #f44336 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4) !important;
      }
      
      .redirect-cancelled {
        color: #FFD93D !important;
      }
      
      .redirect-cancelled h3 {
        margin-bottom: 15px !important;
      }
      
      .blocked-time {
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 0.9em !important;
        margin-top: 20px !important;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      @media (max-width: 600px) {
        .blocked-container {
          padding: 40px 20px !important;
          margin: 10px !important;
          max-width: 95% !important;
        }
        
        h1 {
          font-size: 2em !important;
        }
        
        .blocked-icon {
          font-size: 60px !important;
        }
        
        .redirect-info {
          padding: 20px !important;
        }
      }
      </style>
    `;
  }
}