// Block page generator for content script
import { determineWhitelistTarget, getWhitelistLabel } from '../utils/site-utils.js';

/**
 * Generate HTML for the blocked page
 */
export function generateHTML(isRedirectMode = false, redirectUrl = '', redirectDelay = 0) {
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
 * Generate CSS styles for the blocked page
 */
export function generateSTYLING() {
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

/**
 * Create blocked page with redirect countdown
 */
export function createBlockedPageWithRedirect(redirectUrl, redirectDelay) {
  const blockedPage = generateHTML(true, redirectUrl, redirectDelay);
  const style = generateSTYLING();
  
  // Clear the entire document
  document.documentElement.innerHTML = blockedPage;
  
  // Inject the styles
  const head = document.head || document.getElementsByTagName("head")[0];
  head.insertAdjacentHTML("beforeend", style);
}

/**
 * Create the blocked page dynamically
 */
export function createBlockedPage() {
  const blockedPage = generateHTML(false);
  const style = generateSTYLING();
  
  // Clear the entire document
  document.documentElement.innerHTML = blockedPage;
  
  // Inject the styles
  const head = document.head || document.getElementsByTagName("head")[0];
  head.insertAdjacentHTML("beforeend", style);
}