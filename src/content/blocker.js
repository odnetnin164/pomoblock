/**
 * Main site blocking functionality
 */

import { normalizeURL } from '../shared/utils/url-utils.js';
import { getBlockedWebsites, getWhitelistedPaths } from '../shared/utils/storage.js';
import { debugLog, debugError } from '../shared/utils/debug.js';
import { WhitelistChecker } from './whitelist-checker.js';
import { BlockedPageGenerator } from './ui/blocked-page.js';

export class SiteBlocker {
  constructor(settings) {
    this.settings = settings;
    this.restrictedSites = new Set();
    this.whitelistChecker = new WhitelistChecker();
    this.blockedPageGenerator = new BlockedPageGenerator();
  }

  /**
   * Update settings
   * @param {Object} newSettings - New settings object
   */
  updateSettings(newSettings) {
    this.settings = newSettings;
    debugLog('Blocker settings updated', newSettings);
  }

  /**
   * Check if site should be blocked and take action
   */
  async checkAndBlock() {
    try {
      // If extension is disabled, don't block anything
      if (!this.settings.extensionEnabled) {
        debugLog('Extension is disabled, exiting');
        return;
      }

      // Load blocked sites and whitelisted paths
      await this.loadBlockingData();

      if (this.restrictedSites.size > 0) {
        debugLog('About to check if restricted');
        this.checkIfRestricted();
      } else {
        debugLog('No blocked websites configured');
      }
    } catch (error) {
      debugError('Error in checkAndBlock', error);
    }
  }

  /**
   * Load blocked websites and whitelisted paths
   */
  async loadBlockingData() {
    try {
      const [blockedWebsites, whitelistedPaths] = await Promise.all([
        getBlockedWebsites(),
        getWhitelistedPaths()
      ]);

      debugLog('Blocked websites array', blockedWebsites);
      debugLog('Whitelisted paths array', whitelistedPaths);

      // Build restricted sites set
      this.restrictedSites.clear();
      if (blockedWebsites && blockedWebsites.length > 0) {
        blockedWebsites.forEach((item) => {
          this.restrictedSites.add(item.toLowerCase());
        });
        debugLog('Restricted sites built', Array.from(this.restrictedSites));
      }

      // Update whitelist checker
      this.whitelistChecker.updatePaths(whitelistedPaths);
    } catch (error) {
      debugError('Error loading blocking data', error);
    }
  }

  /**
   * Check if the current website should be blocked
   * @returns {boolean} True if should be blocked
   */
  shouldBlockWebsite() {
    const currentUrl = window.location.href;
    const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
    const currentPathname = window.location.pathname.toLowerCase();
    
    debugLog('Checking URL', currentUrl);
    debugLog('Hostname', currentHostname);
    debugLog('Pathname', currentPathname);
    debugLog('Against restricted sites', Array.from(this.restrictedSites));
    
    // First check if this path is whitelisted
    if (this.whitelistChecker.isWhitelisted()) {
      debugLog('Site is whitelisted, not blocking');
      return false;
    }
    
    // Check each blocked site
    for (const site of this.restrictedSites) {
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
  checkIfRestricted() {
    debugLog('check_if_restricted called');
    
    if (this.shouldBlockWebsite()) {
      debugLog('Site should be blocked!');
      debugLog('Block mode is', this.settings.blockMode);
      
      if (this.settings.blockMode === 'redirect') {
        debugLog('Redirect mode - showing blocked page with countdown');
        this.blockedPageGenerator.createBlockedPageWithRedirect(this.settings);
      } else {
        debugLog('Block mode - showing blocked page');
        this.blockedPageGenerator.createBlockedPage();
      }
    } else {
      debugLog('Site should NOT be blocked');
    }
  }
}