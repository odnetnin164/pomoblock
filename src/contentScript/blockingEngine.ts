import { normalizeURL } from '@shared/urlUtils';
import { logger } from '@shared/logger';

export class BlockingEngine {
  private restrictedSites = new Set<string>();
  private whitelistedPaths = new Set<string>();

  constructor() {
    this.restrictedSites = new Set();
    this.whitelistedPaths = new Set();
  }

  /**
   * Update the blocked sites list
   */
  updateBlockedSites(sites: string[]): void {
    this.restrictedSites.clear();
    sites.forEach(site => {
      this.restrictedSites.add(site.toLowerCase());
    });
    logger.log('Updated blocked sites', Array.from(this.restrictedSites));
  }

  /**
   * Update the whitelisted paths list
   */
  updateWhitelistedPaths(paths: string[]): void {
    this.whitelistedPaths.clear();
    paths.forEach(path => {
      this.whitelistedPaths.add(path.toLowerCase());
    });
    logger.log('Updated whitelisted paths', Array.from(this.whitelistedPaths));
  }

  /**
   * Check if current URL matches any whitelisted path
   */
  isWhitelistedPath(): boolean {
    const currentUrl = window.location.href;
    const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
    const currentPathname = window.location.pathname.toLowerCase();
    
    logger.log('Checking whitelisted paths for', { currentHostname, currentPathname });
    
    for (const whitelistedPath of this.whitelistedPaths) {
      logger.log('Checking against whitelisted path', whitelistedPath);
      
      if (whitelistedPath.includes('/')) {
        // This is a path-specific whitelist entry
        const [pathDomain, ...pathParts] = whitelistedPath.split('/');
        const pathPath = ('/' + pathParts.join('/')).toLowerCase();
        const normalizedPathDomain = normalizeURL(pathDomain.toLowerCase());
        
        logger.log('Path-based whitelist check', { 
          pathDomain: normalizedPathDomain, 
          pathPath, 
          currentHostname, 
          currentPathname 
        });
        
        // Check if domain matches and current path starts with whitelisted path
        if (currentHostname === normalizedPathDomain && currentPathname.startsWith(pathPath)) {
          logger.log('WHITELIST PATH MATCH FOUND', { whitelistedPath, currentHostname, currentPathname });
          return true;
        }
      } else {
        // This is a domain-only whitelist entry
        const normalizedDomain = normalizeURL(whitelistedPath.toLowerCase());
        
        // Exact domain match
        if (currentHostname === normalizedDomain) {
          logger.log('WHITELIST DOMAIN MATCH FOUND', { currentHostname, whitelistedPath: normalizedDomain });
          return true;
        }
        
        // Subdomain match
        if (currentHostname.endsWith('.' + normalizedDomain)) {
          logger.log('WHITELIST SUBDOMAIN MATCH FOUND', { currentHostname, whitelistedPath: normalizedDomain });
          return true;
        }
      }
    }
    
    logger.log('No whitelist match found');
    return false;
  }

  /**
   * Check if the current website should be blocked
   */
  shouldBlockWebsite(): boolean {
    const currentUrl = window.location.href;
    const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
    const currentPathname = window.location.pathname.toLowerCase();
    
    logger.log('Checking URL', currentUrl);
    logger.log('Hostname', currentHostname);
    logger.log('Pathname', currentPathname);
    logger.log('Against restricted sites', Array.from(this.restrictedSites));
    
    // First check if this path is whitelisted
    if (this.isWhitelistedPath()) {
      logger.log('Site is whitelisted, not blocking');
      return false;
    }
    
    // Check each blocked site
    for (const site of this.restrictedSites) {
      logger.log('Comparing with', site);
      
      // Handle path-based blocking (like Reddit subreddits, YouTube channels)
      if (site.includes('/')) {
        const [siteDomain, ...pathParts] = site.split('/');
        const sitePath = ('/' + pathParts.join('/')).toLowerCase();
        const normalizedSiteDomain = normalizeURL(siteDomain.toLowerCase());
        
        logger.log('Path-based check', { siteDomain: normalizedSiteDomain, sitePath, currentHostname, currentPathname });
        
        // Check if domain matches and path starts with the blocked path
        if (currentHostname === normalizedSiteDomain && currentPathname.startsWith(sitePath)) {
          logger.log('PATH MATCH FOUND', { site, currentHostname, currentPathname });
          return true;
        }
      } else {
        // Handle domain-based blocking
        const normalizedSite = normalizeURL(site.toLowerCase());
        
        // Exact domain match
        if (currentHostname === normalizedSite) {
          logger.log('EXACT DOMAIN MATCH FOUND', { currentHostname, matchedSite: normalizedSite });
          return true;
        }
        
        // Subdomain match (e.g., blocking "google.com" should block "mail.google.com")
        if (currentHostname.endsWith('.' + normalizedSite)) {
          logger.log('SUBDOMAIN MATCH FOUND', { currentHostname, matchedSite: normalizedSite });
          return true;
        }
        
        // Partial match for complex domains
        if (currentHostname.includes(normalizedSite)) {
          logger.log('PARTIAL MATCH FOUND', { currentHostname, matchedSite: normalizedSite });
          return true;
        }
      }
    }
    
    logger.log('No match found');
    return false;
  }

  /**
   * Get current site information for display
   */
  getCurrentSiteInfo(): { hostname: string; pathname: string; url: string } {
    return {
      hostname: normalizeURL(window.location.hostname.toLowerCase()),
      pathname: window.location.pathname.toLowerCase(),
      url: window.location.href
    };
  }
}