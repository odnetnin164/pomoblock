const restricted_sites = new Set();
const whitelisted_paths = new Set();
let extensionSettings = {
  blockMode: 'block',
  redirectUrl: 'https://www.google.com',
  redirectDelay: 3,
  extensionEnabled: true,
  debugEnabled: false
}

debugLog('ContentScript fully loaded');;

// Visual debug function that shows messages on the page
function debugLog(message, data = null) {
  console.log(`[PomoBlock Debug] ${message}`, data || '');
  
  // Only show visual debug if enabled
  if (!extensionSettings.debugEnabled) {
    return;
  }
  
  // Also show debug info visually on the page
  const debugDiv = document.getElementById('siteblocker-debug') || createDebugDiv();
  const logEntry = document.createElement('div');
  logEntry.style.cssText = 'margin: 2px 0; font-size: 12px; color: #fff; background: rgba(0,0,0,0.7); padding: 2px 5px; border-radius: 3px; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;';
  logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message} ${data ? JSON.stringify(data) : ''}`;
  debugDiv.appendChild(logEntry);
  
  // Keep only last 10 entries
  while (debugDiv.children.length > 11) { // 11 because we have the title div
    debugDiv.removeChild(debugDiv.children[1]); // Remove first log entry (keep title)
  }
}

function createDebugDiv() {
  const debugDiv = document.createElement('div');
  debugDiv.id = 'siteblocker-debug';
  debugDiv.style.cssText = `
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    width: 320px !important;
    max-height: 250px !important;
    overflow-y: auto !important;
    background: rgba(255, 0, 0, 0.9) !important;
    color: white !important;
    padding: 10px !important;
    border-radius: 5px !important;
    font-family: monospace !important;
    font-size: 11px !important;
    z-index: 999999 !important;
    border: 2px solid #fff !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  `;
  
  const title = document.createElement('div');
  title.textContent = 'PomoBlock Debug';
  title.style.cssText = 'font-weight: bold; margin-bottom: 5px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 3px;';
  debugDiv.appendChild(title);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute !important;
    top: 5px !important;
    right: 8px !important;
    background: none !important;
    border: none !important;
    color: white !important;
    font-size: 16px !important;
    font-weight: bold !important;
    cursor: pointer !important;
    padding: 0 !important;
    width: 20px !important;
    height: 20px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  closeButton.addEventListener('click', function() {
    debugDiv.remove();
  });
  debugDiv.appendChild(closeButton);
  
  document.documentElement.appendChild(debugDiv);
  return debugDiv;
}

// Force immediate execution
debugLog('ContentScript started');
debugLog('Current URL', window.location.href);
debugLog('Document ready state', document.readyState);

// Retrieve settings, blocked websites, and whitelisted paths from Chrome storage
chrome.storage.sync.get(['blockedWebsitesArray', 'whitelistedPathsArray', 'blockMode', 'redirectUrl', 'redirectDelay', 'extensionEnabled', 'debugEnabled'], function (data) {
  debugLog('Storage get callback fired');
  debugLog('Raw storage data', data);
  
  // Load extension settings
  extensionSettings = {
    blockMode: data.blockMode || 'block',
    redirectUrl: data.redirectUrl || 'https://www.google.com',
    redirectDelay: data.redirectDelay !== undefined ? data.redirectDelay : 3,
    extensionEnabled: data.extensionEnabled !== undefined ? data.extensionEnabled : true,
    debugEnabled: data.debugEnabled !== undefined ? data.debugEnabled : false
  };
  
  debugLog('Processed settings', extensionSettings);
  
  // If extension is disabled, don't block anything
  if (!extensionSettings.extensionEnabled) {
    debugLog('Extension is disabled, exiting');
    return;
  }
  
  const blockedWebsitesArray = data.blockedWebsitesArray || [];
  const whitelistedPathsArray = data.whitelistedPathsArray || [];
  
  debugLog('Blocked websites array', blockedWebsitesArray);
  debugLog('Whitelisted paths array', whitelistedPathsArray);
  
  if (blockedWebsitesArray && blockedWebsitesArray.length > 0) {
    // Add the items from blockedWebsitesArray to the set restricted_sites
    blockedWebsitesArray.forEach((item) => {
      restricted_sites.add(item.toLowerCase());
    });

    debugLog('Restricted sites built', Array.from(restricted_sites));
  }
  
  if (whitelistedPathsArray && whitelistedPathsArray.length > 0) {
    // Add the items from whitelistedPathsArray to the set whitelisted_paths
    whitelistedPathsArray.forEach((item) => {
      whitelisted_paths.add(item.toLowerCase());
    });

    debugLog('Whitelisted paths built', Array.from(whitelisted_paths));
  }
  
  if (restricted_sites.size > 0) {
    // Call the function to check if the website should be blocked
    debugLog('About to check if restricted');
    check_if_restricted();
  } else {
    debugLog('No blocked websites configured');
  }
});

// Normalize URL by removing 'www.' from the beginning
function normalizeURL(url) {
  return url.replace(/^www\./i, "");
}

// Check if current URL matches any whitelisted path
function isWhitelistedPath() {
  const currentUrl = window.location.href;
  const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
  const currentPathname = window.location.pathname.toLowerCase();
  
  debugLog('Checking whitelisted paths for', { currentHostname, currentPathname });
  
  for (const whitelistedPath of whitelisted_paths) {
    debugLog('Checking against whitelisted path', whitelistedPath);
    
    if (whitelistedPath.includes('/')) {
      // This is a path-specific whitelist entry
      const [pathDomain, ...pathParts] = whitelistedPath.split('/');
      const pathPath = ('/' + pathParts.join('/')).toLowerCase();
      const normalizedPathDomain = normalizeURL(pathDomain.toLowerCase());
      
      debugLog('Path-based whitelist check', { 
        pathDomain: normalizedPathDomain, 
        pathPath, 
        currentHostname, 
        currentPathname 
      });
      
      // Check if domain matches and current path starts with whitelisted path
      if (currentHostname === normalizedPathDomain && currentPathname.startsWith(pathPath)) {
        debugLog('WHITELIST PATH MATCH FOUND', { whitelistedPath, currentHostname, currentPathname });
        return true;
      }
    } else {
      // This is a domain-only whitelist entry
      const normalizedDomain = normalizeURL(whitelistedPath.toLowerCase());
      
      // Exact domain match
      if (currentHostname === normalizedDomain) {
        debugLog('WHITELIST DOMAIN MATCH FOUND', { currentHostname, whitelistedPath: normalizedDomain });
        return true;
      }
      
      // Subdomain match
      if (currentHostname.endsWith('.' + normalizedDomain)) {
        debugLog('WHITELIST SUBDOMAIN MATCH FOUND', { currentHostname, whitelistedPath: normalizedDomain });
        return true;
      }
    }
  }
  
  debugLog('No whitelist match found');
  return false;
}

// Enhanced function to check if the current website should be blocked
function shouldBlockWebsite() {
  const currentUrl = window.location.href;
  const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
  const currentPathname = window.location.pathname.toLowerCase();
  
  debugLog('Checking URL', currentUrl);
  debugLog('Hostname', currentHostname);
  debugLog('Pathname', currentPathname);
  debugLog('Against restricted sites', Array.from(restricted_sites));
  
  // First check if this path is whitelisted
  if (isWhitelistedPath()) {
    debugLog('Site is whitelisted, not blocking');
    return false;
  }
  
  // Check each blocked site
  for (const site of restricted_sites) {
    debugLog('Comparing with', site);
    
    // Handle path-based blocking (like Reddit subreddits, YouTube channels)
    if (site.includes('/')) {
      const [siteDomain, ...pathParts] = site.split('/');
      const sitePath = ('/' + pathParts.join('/')).toLowerCase();
      const normalizedSiteDomain = normalizeURL(siteDomain.toLowerCase());
      
      debugLog('Path-based check', { siteDomain: normalizedSiteDomain, sitePath, currentHostname, currentPathname });
      
      // Check if domain matches and path starts with the blocked path
      if (currentHostname === normalizedSiteDomain && currentPathname.startsWith(sitePath)) {
        debugLog('PATH MATCH FOUND', { site, currentHostname, currentPathname });
        return true;
      }
    } else {
      // Handle domain-based blocking
      const normalizedSite = normalizeURL(site.toLowerCase());
      
      // Exact domain match
      if (currentHostname === normalizedSite) {
        debugLog('EXACT DOMAIN MATCH FOUND', { currentHostname, matchedSite: normalizedSite });
        return true;
      }
      
      // Subdomain match (e.g., blocking "google.com" should block "mail.google.com")
      if (currentHostname.endsWith('.' + normalizedSite)) {
        debugLog('SUBDOMAIN MATCH FOUND', { currentHostname, matchedSite: normalizedSite });
        return true;
      }
      
      // Partial match for complex domains
      if (currentHostname.includes(normalizedSite)) {
        debugLog('PARTIAL MATCH FOUND', { currentHostname, matchedSite: normalizedSite });
        return true;
      }
    }
  }
  
  debugLog('No match found');
  return false;
}

// Check if the website should be blocked and take appropriate action
function check_if_restricted() {
  debugLog('check_if_restricted called');
  
  if (shouldBlockWebsite()) {
    debugLog('Site should be blocked!');
    debugLog('Block mode is', extensionSettings.blockMode);
    
    if (extensionSettings.blockMode === 'redirect') {
      debugLog('Redirect mode - showing blocked page with countdown');
      // Show blocked page with countdown, then redirect
      createBlockedPageWithRedirect();
    } else {
      debugLog('Block mode - showing blocked page');
      createBlockedPage();
    }
  } else {
    debugLog('Site should NOT be blocked');
  }
}

// Handle redirect to specified URL - FIXED VERSION
function handleRedirect() {
  debugLog('handleRedirect called');
  
  const redirectUrl = extensionSettings.redirectUrl || 'https://www.google.com';
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
      
      // Backup method 1
      setTimeout(() => {
        debugLog('Backup: window.location.href');
        window.location.href = redirectUrl;
      }, 50);
      
      // Backup method 2
      setTimeout(() => {
        debugLog('Backup: window.location.assign');
        window.location.assign(redirectUrl);
      }, 100);
      
      // Backup method 3 - try parent/top
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
      
      // If redirect fails, we'll know after 1 second
      setTimeout(() => {
        debugLog('Redirect failed - still on original page');
        showRedirectFailure(redirectUrl);
      }, 1000);
      
    } else {
      debugLog('Invalid protocol, redirecting to Google');
      window.location.replace('https://www.google.com');
    }
  } catch (error) {
    debugLog('Redirect error', error.message);
    showRedirectFailure(redirectUrl);
  }
}

// Show redirect failure message - waits for DOM to be ready
function showRedirectFailure(redirectUrl) {
  function createFailureMessage() {
    // Create the message without relying on document.body
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
      // Last resort - try to wait for DOM
      setTimeout(createFailureMessage, 100);
    }
  }
  
  createFailureMessage();
}

// Create blocked page with redirect countdown
function createBlockedPageWithRedirect() {
  debugLog('Creating blocked page with redirect countdown');
  
  const redirectUrl = extensionSettings.redirectUrl || 'https://www.google.com';
  const redirectDelay = extensionSettings.redirectDelay || 3;
  
  debugLog('Redirect URL', redirectUrl);
  debugLog('Redirect delay', redirectDelay);
  
  // If delay is 0, redirect immediately
  if (redirectDelay === 0) {
    handleRedirect();
    return;
  }
  
  const blockedPage = generateHTML(true, redirectUrl, redirectDelay);
  const style = generateSTYLING();
  
  // Clear the entire document
  document.documentElement.innerHTML = blockedPage;
  
  // Inject the styles
  const head = document.head || document.getElementsByTagName("head")[0];
  head.insertAdjacentHTML("beforeend", style);
  
  // Start countdown
  startRedirectCountdown(redirectUrl, redirectDelay);
}

// Start the redirect countdown
function startRedirectCountdown(redirectUrl, initialSeconds) {
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
    cancelButton.addEventListener('click', function() {
      debugLog('Redirect cancelled by user');
      clearInterval(countdownInterval);
      showCancelledMessage();
    });
  }
  
  // Start countdown interval
  const countdownInterval = setInterval(() => {
    secondsLeft--;
    debugLog('Countdown tick', secondsLeft);
    
    if (countdownElement) {
      countdownElement.textContent = secondsLeft;
    }
    
    if (secondsLeft <= 0) {
      clearInterval(countdownInterval);
      debugLog('Countdown finished, redirecting');
      handleRedirect();
    }
  }, 1000);
}

// Show cancelled message
function showCancelledMessage() {
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

// Create the blocked page dynamically
function createBlockedPage() {
  debugLog('Creating blocked page');
  
  const blockedPage = generateHTML(false);
  const style = generateSTYLING();
  
  // Clear the entire document
  document.documentElement.innerHTML = blockedPage;
  
  // Inject the styles
  const head = document.head || document.getElementsByTagName("head")[0];
  head.insertAdjacentHTML("beforeend", style);
}

function generateSTYLING() {
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
    
    .whitelist-actions {
      background: rgba(76, 175, 80, 0.1) !important;
      border: 2px solid rgba(76, 175, 80, 0.3) !important;
      border-radius: 15px !important;
      padding: 25px !important;
      margin: 25px 0 !important;
      text-align: center !important;
    }
    
    .whitelist-actions h3 {
      font-size: 1.2em !important;
      margin-bottom: 10px !important;
      color: #4CAF50 !important;
    }
    
    .whitelist-actions p {
      margin-bottom: 20px !important;
      color: rgba(255, 255, 255, 0.9) !important;
      font-size: 0.95em !important;
    }
    
    .whitelist-btn {
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 15px 25px !important;
      font-size: 1em !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.3s ease !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
      width: 100% !important;
      max-width: 300px !important;
      margin: 0 auto !important;
      display: block !important;
      box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3) !important;
    }
    
    .whitelist-btn:hover:not(:disabled) {
      background: #45a049 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4) !important;
    }
    
    .whitelist-btn:disabled {
      background: rgba(255, 255, 255, 0.3) !important;
      color: rgba(255, 255, 255, 0.7) !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
    }
    
    .whitelist-target-info {
      margin-top: 15px !important;
    }
    
    .whitelist-target-info small {
      color: rgba(255, 255, 255, 0.8) !important;
      font-size: 0.85em !important;
      background: rgba(255, 255, 255, 0.1) !important;
      padding: 8px 12px !important;
      border-radius: 8px !important;
      display: inline-block !important;
    }
    
    .whitelist-target-info strong {
      color: #FFD93D !important;
      font-family: 'Courier New', monospace !important;
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

function generateHTML(isRedirectMode = false, redirectUrl = '', redirectDelay = 0) {
  const currentTime = new Date().toLocaleString();
  const blockedURL = window.location.hostname + window.location.pathname;
  
  // Determine what should be whitelisted (priority: path > subdomain > domain)
  const whitelistTarget = determineWhitelistTarget();
  const whitelistLabel = getWhitelistLabel(whitelistTarget);
  
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
      <script>
      </script>
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

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    debugLog('Storage changed', changes);
    
    if (changes.blockedWebsitesArray || changes.whitelistedPathsArray) {
      debugLog('Blocked websites or whitelisted paths changed, reloading');
      location.reload();
    }
    
    if (changes.blockMode || changes.redirectUrl || changes.redirectDelay || changes.extensionEnabled || changes.debugEnabled) {
      if (changes.blockMode) {
        extensionSettings.blockMode = changes.blockMode.newValue || 'block';
      }
      if (changes.redirectUrl) {
        extensionSettings.redirectUrl = changes.redirectUrl.newValue || 'https://www.google.com';
      }
      if (changes.redirectDelay !== undefined) {
        extensionSettings.redirectDelay = changes.redirectDelay.newValue !== undefined ? changes.redirectDelay.newValue : 3;
      }
      if (changes.extensionEnabled !== undefined) {
        extensionSettings.extensionEnabled = changes.extensionEnabled.newValue;
        if (!extensionSettings.extensionEnabled) {
          location.reload();
        }
      }
      if (changes.debugEnabled !== undefined) {
        extensionSettings.debugEnabled = changes.debugEnabled.newValue;
        // Hide debug div if debug is disabled
        if (!extensionSettings.debugEnabled) {
          const existingDebugDiv = document.getElementById('siteblocker-debug');
          if (existingDebugDiv) {
            existingDebugDiv.remove();
          }
        }
      }
    }
  }
});

// Determine the best whitelist target (priority: specific path > subdomain > domain)
function determineWhitelistTarget() {
  const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
  const currentPathname = window.location.pathname.toLowerCase();
  
  // Priority 1: If we're on a specific path, suggest whitelisting the path
  if (currentPathname !== '/' && currentPathname.length > 1) {
    // Special handling for known sites with meaningful paths
    if (currentHostname === 'reddit.com' && currentPathname.startsWith('/r/')) {
      const subredditMatch = currentPathname.match(/^\/r\/([^\/]+)/);
      if (subredditMatch) {
        return `reddit.com/r/${subredditMatch[1]}`;
      }
    }
    
    if (currentHostname === 'youtube.com') {
      const channelMatch = currentPathname.match(/^\/(c|channel|user)\/([^\/]+)/);
      if (channelMatch) {
        return `youtube.com/${channelMatch[1]}/${channelMatch[2]}`;
      }
    }
    
    if ((currentHostname === 'twitter.com' || currentHostname === 'x.com')) {
      const userMatch = currentPathname.match(/^\/([^\/]+)$/);
      if (userMatch && !['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'settings'].includes(userMatch[1])) {
        return `${currentHostname}/${userMatch[1]}`;
      }
    }
    
    // For other sites with meaningful paths, suggest the first path segment
    const pathSegments = currentPathname.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length > 0) {
      return `${currentHostname}/${pathSegments[0]}`;
    }
  }
  
  // Priority 2: If subdomain, suggest whitelisting the subdomain
  const parts = currentHostname.split('.');
  if (parts.length > 2) {
    return currentHostname;
  }
  
  // Priority 3: Fallback to domain
  return currentHostname;
}

// Get user-friendly label for whitelist target
function getWhitelistLabel(target) {
  if (target.includes('reddit.com/r/')) {
    const subreddit = target.split('/r/')[1];
    return `r/${subreddit} subreddit`;
  }
  
  if (target.includes('youtube.com/channel/') || target.includes('youtube.com/c/')) {
    return 'this YouTube channel';
  }
  
  if (target.includes('youtube.com/user/')) {
    return 'this YouTube user';
  }
  
  if ((target.includes('twitter.com/') || target.includes('x.com/')) && target.split('/').length === 2) {
    const username = target.split('/')[1];
    return `@${username} profile`;
  }
  
  if (target.includes('/')) {
    const pathPart = target.split('/').slice(1).join('/');
    return `${target.split('/')[0]}/${pathPart} section`;
  }
  
  const parts = target.split('.');
  if (parts.length > 2) {
    return `${parts[0]} subdomain`;
  }
  
  return `${target} domain`;
}