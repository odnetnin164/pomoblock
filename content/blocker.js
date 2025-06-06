// Main blocking logic for content script
import { normalizeURL } from '../utils/url-utils.js';
import { debugLog } from './debug.js';
import { isWhitelistedPath } from './whitelist.js';
import { createBlockedPage, createBlockedPageWithRedirect } from './page-generator.js';

/**
 * Enhanced function to check if the current website should be blocked
 */
export function shouldBlockWebsite(restrictedSites, whitelistedPaths) {
  const currentUrl = window.location.href;
  const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
  const currentPathname = window.location.pathname.toLowerCase();
  
  debugLog('Checking URL', currentUrl);
  debugLog('Hostname', currentHostname);
  debugLog('Pathname', currentPathname);
  debugLog('Against restricted sites', Array.from(restrictedSites));
  
  // First check if this path is whitelisted
  if (isWhitelistedPath(whitelistedPaths)) {
    debugLog('Site is whitelisted, not blocking');
    return false;
  }
  
  // Check each blocked site
  for (const site of restrictedSites) {
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

/**
 * Check if the website should be blocked and take appropriate action
 */
export function checkIfRestricted(restrictedSites, whitelistedPaths, extensionSettings) {
  debugLog('checkIfRestricted called');
  
  if (shouldBlockWebsite(restrictedSites, whitelistedPaths)) {
    debugLog('Site should be blocked!');
    debugLog('Block mode is', extensionSettings.blockMode);
    
    if (extensionSettings.blockMode === 'redirect') {
      debugLog('Redirect mode - showing blocked page with countdown');
      // Show blocked page with countdown, then redirect
      createBlockedPageWithRedirect(extensionSettings.redirectUrl, extensionSettings.redirectDelay);
      
      // Start countdown if delay > 0
      if (extensionSettings.redirectDelay > 0) {
        startRedirectCountdown(extensionSettings.redirectUrl, extensionSettings.redirectDelay);
      } else {
        handleRedirect(extensionSettings.redirectUrl);
      }
    } else {
      debugLog('Block mode - showing blocked page');
      createBlockedPage();
    }
  } else {
    debugLog('Site should NOT be blocked');
  }
}

/**
 * Start the redirect countdown
 */
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
      handleRedirect(redirectUrl);
    }
  }, 1000);
}

/**
 * Show cancelled message
 */
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

/**
 * Handle redirect to specified URL
 */
function handleRedirect(redirectUrl) {
  debugLog('handleRedirect called');
  
  const finalRedirectUrl = redirectUrl || 'https://www.google.com';
  debugLog('Redirect URL', finalRedirectUrl);
  
  try {
    // Validate redirect URL
    const url = new URL(finalRedirectUrl);
    debugLog('URL validation passed', url.href);
    
    // Only allow http and https protocols for security
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      debugLog('Protocol is valid, attempting immediate redirect');
      
      // IMMEDIATE REDIRECT
      debugLog('Attempting window.location.replace');
      window.location.replace(finalRedirectUrl);
      
      // Backup methods
      setTimeout(() => {
        debugLog('Backup: window.location.href');
        window.location.href = finalRedirectUrl;
      }, 50);
      
      setTimeout(() => {
        debugLog('Backup: window.location.assign');
        window.location.assign(finalRedirectUrl);
      }, 100);
      
      // Try parent/top
      setTimeout(() => {
        debugLog('Backup: top.location');
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = finalRedirectUrl;
          }
          if (window.parent && window.parent !== window) {
            window.parent.location.href = finalRedirectUrl;
          }
        } catch (e) {
          debugLog('Parent/top redirect failed', e.message);
        }
      }, 150);
      
      // If redirect fails, show failure message
      setTimeout(() => {
        debugLog('Redirect failed - still on original page');
        showRedirectFailure(finalRedirectUrl);
      }, 1000);
      
    } else {
      debugLog('Invalid protocol, redirecting to Google');
      window.location.replace('https://www.google.com');
    }
  } catch (error) {
    debugLog('Redirect error', error.message);
    showRedirectFailure(finalRedirectUrl);
  }
}

/**
 * Show redirect failure message
 */
function showRedirectFailure(redirectUrl) {
  function createFailureMessage() {
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
  }
  
  createFailureMessage();
}