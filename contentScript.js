// Main content script for PomoBlock extension
import { getSettings, getBlockedWebsites, getWhitelistedPaths } from './utils/storage-utils.js';
import { debugLog, setDebugEnabled, hideDebugDiv } from './content/debug.js';
import { checkIfRestricted } from './content/blocker.js';

// Initialize sets and settings
const restrictedSites = new Set();
const whitelistedPaths = new Set();
let extensionSettings = {
  blockMode: 'block',
  redirectUrl: 'https://www.google.com',
  redirectDelay: 3,
  extensionEnabled: true,
  debugEnabled: false
};

// Force immediate execution
debugLog('ContentScript started');
debugLog('Current URL', window.location.href);
debugLog('Document ready state', document.readyState);

// Initialize the extension
initializeExtension();

async function initializeExtension() {
  try {
    debugLog('Initializing extension');
    
    // Get all data from storage
    const [settings, blockedWebsites, whitelistedPathsArray] = await Promise.all([
      getSettings(),
      getBlockedWebsites(),
      getWhitelistedPaths()
    ]);
    
    // Update extension settings
    extensionSettings = settings;
    setDebugEnabled(extensionSettings.debugEnabled);
    
    debugLog('Storage get callback fired');
    debugLog('Processed settings', extensionSettings);
    
    // If extension is disabled, don't block anything
    if (!extensionSettings.extensionEnabled) {
      debugLog('Extension is disabled, exiting');
      return;
    }
    
    debugLog('Blocked websites array', blockedWebsites);
    debugLog('Whitelisted paths array', whitelistedPathsArray);
    
    // Populate restricted sites set
    if (blockedWebsites && blockedWebsites.length > 0) {
      blockedWebsites.forEach((item) => {
        restrictedSites.add(item.toLowerCase());
      });
      debugLog('Restricted sites built', Array.from(restrictedSites));
    }
    
    // Populate whitelisted paths set
    if (whitelistedPathsArray && whitelistedPathsArray.length > 0) {
      whitelistedPathsArray.forEach((item) => {
        whitelistedPaths.add(item.toLowerCase());
      });
      debugLog('Whitelisted paths built', Array.from(whitelistedPaths));
    }
    
    // Check if the website should be blocked
    if (restrictedSites.size > 0) {
      debugLog('About to check if restricted');
      checkIfRestricted(restrictedSites, whitelistedPaths, extensionSettings);
    } else {
      debugLog('No blocked websites configured');
    }
    
  } catch (error) {
    debugLog('Error initializing extension', error.message);
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    debugLog('Storage changed', changes);
    
    // If blocked websites or whitelisted paths changed, reload the page
    if (changes.blockedWebsitesArray || changes.whitelistedPathsArray) {
      debugLog('Blocked websites or whitelisted paths changed, reloading');
      location.reload();
      return;
    }
    
    // Update settings if they changed
    let needsReload = false;
    
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
        needsReload = true;
      }
    }
    
    if (changes.debugEnabled !== undefined) {
      extensionSettings.debugEnabled = changes.debugEnabled.newValue;
      setDebugEnabled(extensionSettings.debugEnabled);
      
      // Hide debug div if debug is disabled
      if (!extensionSettings.debugEnabled) {
        hideDebugDiv();
      }
    }
    
    if (needsReload) {
      location.reload();
    }
  }
});