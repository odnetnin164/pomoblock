// Tab analysis utilities for popup
import { determineBlockTarget, parseURL } from '../utils/url-utils.js';
import { isSpecialSite } from '../utils/site-utils.js';
import { getBlockedWebsites, getWhitelistedPaths } from '../utils/storage-utils.js';

export class TabAnalyzer {
  constructor() {
    this.currentTabUrl = '';
    this.targetToBlock = '';
    this.isAlreadyBlocked = false;
    this.isWhitelisted = false;
  }

  /**
   * Get current tab information
   */
  async getCurrentTabInfo() {
    return new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url) {
          this.currentTabUrl = tabs[0].url;
          resolve(tabs[0]);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Analyze current tab and determine block target
   */
  analyzeCurrentTab() {
    const urlData = parseURL(this.currentTabUrl);
    if (!urlData) {
      return {
        canBlock: false,
        displayUrl: 'Invalid URL',
        target: null,
        isSpecial: false
      };
    }

    const { hostname, pathname } = urlData;
    
    // Determine what should be blocked
    this.targetToBlock = determineBlockTarget(hostname, pathname);
    
    return {
      canBlock: !!this.targetToBlock,
      displayUrl: hostname + (pathname !== '/' ? pathname : ''),
      target: this.targetToBlock,
      isSpecial: isSpecialSite(hostname)
    };
  }

  /**
   * Check current site status (blocked/whitelisted)
   */
  async checkCurrentSiteStatus() {
    if (!this.targetToBlock) return;
    
    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);
      
      this.isAlreadyBlocked = blockedWebsites.includes(this.targetToBlock);
      this.isWhitelisted = this.checkIfWhitelisted(whitelistedPaths);
      
      return {
        isBlocked: this.isAlreadyBlocked,
        isWhitelisted: this.isWhitelisted
      };
    } catch (error) {
      console.error('Error checking site status:', error);
      return {
        isBlocked: false,
        isWhitelisted: false
      };
    }
  }

  /**
   * Check if the current target is whitelisted
   */
  checkIfWhitelisted(whitelistedPaths) {
    const urlData = parseURL(this.currentTabUrl);
    if (!urlData) return false;
    
    const currentHostname = urlData.normalized;
    const currentPathname = urlData.cleanPathname;
    
    for (const whitelistedPath of whitelistedPaths) {
      const pathLower = whitelistedPath.toLowerCase();
      
      if (pathLower.includes('/')) {
        // Path-specific whitelist
        const [pathDomain, ...pathParts] = pathLower.split('/');
        const pathPath = '/' + pathParts.join('/');
        
        if (currentHostname === pathDomain && currentPathname.startsWith(pathPath)) {
          return true;
        }
      } else {
        // Domain-only whitelist
        if (currentHostname === pathLower || currentHostname.endsWith('.' + pathLower)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if current page would be blocked by an existing broader rule
   */
  async wouldBeBlockedByExistingRule() {
    const urlData = parseURL(this.currentTabUrl);
    if (!urlData) return false;
    
    try {
      const blockedWebsites = await getBlockedWebsites();
      const currentHostname = urlData.normalized;
      
      for (const site of blockedWebsites) {
        const siteLower = site.toLowerCase();
        
        if (siteLower.includes('/')) {
          // Path-based block - check if current path is more specific
          continue;
        } else {
          // Domain-based block - check if current page would be blocked
          if (currentHostname === siteLower || currentHostname.endsWith('.' + siteLower)) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking existing rules:', error);
      return false;
    }
  }

  /**
   * Find the exact whitelist entry that matches the current page
   */
  async findMatchingWhitelistEntry() {
    const urlData = parseURL(this.currentTabUrl);
    if (!urlData) return null;
    
    try {
      const whitelistedPaths = await getWhitelistedPaths();
      const currentHostname = urlData.normalized;
      const currentPathname = urlData.cleanPathname;
      
      for (const whitelistedPath of whitelistedPaths) {
        const pathLower = whitelistedPath.toLowerCase();
        
        if (pathLower.includes('/')) {
          // Path-specific whitelist
          const [pathDomain, ...pathParts] = pathLower.split('/');
          const pathPath = '/' + pathParts.join('/');
          
          if (currentHostname === pathDomain && currentPathname.startsWith(pathPath)) {
            return whitelistedPath; // Return original case version
          }
        } else {
          // Domain-only whitelist
          if (currentHostname === pathLower || currentHostname.endsWith('.' + pathLower)) {
            return whitelistedPath; // Return original case version
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding whitelist entry:', error);
      return null;
    }
  }

  /**
   * Get current analysis state
   */
  getState() {
    return {
      currentTabUrl: this.currentTabUrl,
      targetToBlock: this.targetToBlock,
      isAlreadyBlocked: this.isAlreadyBlocked,
      isWhitelisted: this.isWhitelisted
    };
  }
}