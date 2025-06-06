/**
 * Site analysis functionality for popup
 */

import { determineBlockTarget, normalizeURL } from '../shared/utils/url-utils.js';
import { isSpecialSite } from '../shared/utils/site-detection.js';

export class SiteAnalyzer {
  /**
   * Analyze a site URL and determine blocking information
   * @param {string} url - The URL to analyze
   * @returns {Object} Analysis result
   */
  analyzeSite(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      // Check if this is a blockable site
      const canBlock = this.canBlockSite(hostname);
      if (!canBlock) {
        return {
          canBlock: false,
          displayUrl: 'Cannot block this page',
          blockTarget: null,
          isSpecialSite: false
        };
      }
      
      const displayUrl = hostname + (pathname !== '/' ? pathname : '');
      const blockTarget = determineBlockTarget(hostname, pathname);
      const isSpecial = isSpecialSite(hostname);
      
      return {
        canBlock: true,
        displayUrl,
        blockTarget,
        isSpecialSite: isSpecial
      };
    } catch (error) {
      return {
        canBlock: false,
        displayUrl: 'Invalid URL',
        blockTarget: null,
        isSpecialSite: false
      };
    }
  }

  /**
   * Check if a site can be blocked
   * @param {string} hostname - The hostname to check
   * @returns {boolean} True if can be blocked
   */
  canBlockSite(hostname) {
    // Skip chrome:// and extension pages
    if (hostname.startsWith('chrome') || hostname.includes('extension')) {
      return false;
    }
    
    // Skip local development
    if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if current page is whitelisted
   * @param {string} currentUrl - Current page URL
   * @param {Array} whitelistedPaths - Array of whitelisted paths
   * @returns {boolean} True if whitelisted
   */
  checkIfWhitelisted(currentUrl, whitelistedPaths) {
    try {
      const urlObj = new URL(currentUrl);
      const currentHostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      const currentPathname = urlObj.pathname.toLowerCase();
      
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
    } catch (error) {
      console.error('Error checking whitelist status:', error);
      return false;
    }
  }

  /**
   * Check if current page would be blocked by an existing broader rule
   * @param {string} currentUrl - Current page URL
   * @param {Array} blockedWebsites - Array of blocked websites
   * @returns {boolean} True if would be blocked
   */
  wouldBeBlockedByExistingRule(currentUrl, blockedWebsites) {
    try {
      const urlObj = new URL(currentUrl);
      const currentHostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      
      for (const site of blockedWebsites) {
        const siteLower = site.toLowerCase();
        
        if (siteLower.includes('/')) {
          // Path-based block - skip for this check
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
   * @param {string} currentUrl - Current page URL
   * @param {Array} whitelistedPaths - Array of whitelisted paths
   * @returns {string|null} Matching whitelist entry or null
   */
  findMatchingWhitelistEntry(currentUrl, whitelistedPaths) {
    try {
      const urlObj = new URL(currentUrl);
      const currentHostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      const currentPathname = urlObj.pathname.toLowerCase();
      
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
}