import { normalizeURL } from '@shared/urlUtils';
import { logger } from '@shared/logger';
import { SiteToggleState } from '@shared/types';

/**
 * Central blocking engine that handles all site blocking logic.
 * This is the single source of truth for blocking decisions.
 */
export class BlockingEngine {
  private restrictedSites = new Set<string>();
  private whitelistedPaths = new Set<string>();
  private blockedSitesToggleState: SiteToggleState = {};
  private whitelistedPathsToggleState: SiteToggleState = {};

  constructor() {
    this.restrictedSites = new Set();
    this.whitelistedPaths = new Set();
    this.blockedSitesToggleState = {};
    this.whitelistedPathsToggleState = {};
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
   * Update blocked sites toggle state
   */
  updateBlockedSitesToggleState(toggleState: SiteToggleState): void {
    this.blockedSitesToggleState = { ...toggleState };
    logger.log('Updated blocked sites toggle state', this.blockedSitesToggleState);
  }

  /**
   * Update whitelisted paths toggle state
   */
  updateWhitelistedPathsToggleState(toggleState: SiteToggleState): void {
    this.whitelistedPathsToggleState = { ...toggleState };
    logger.log('Updated whitelisted paths toggle state', this.whitelistedPathsToggleState);
  }

  /**
   * Check if a blocked site is enabled
   */
  isBlockedSiteEnabled(site: string): boolean {
    return this.blockedSitesToggleState[site] ?? true; // Default to enabled
  }

  /**
   * Check if a whitelisted path is enabled
   */
  isWhitelistedPathEnabled(path: string): boolean {
    return this.whitelistedPathsToggleState[path] ?? true; // Default to enabled
  }

  /**
   * Check if a site is in the blocked list (regardless of enabled state)
   */
  isSiteInBlocklist(site: string): boolean {
    return this.restrictedSites.has(site.toLowerCase());
  }

  /**
   * Check if a path is in the whitelist (regardless of enabled state)
   */
  isPathInWhitelist(path: string): boolean {
    return this.whitelistedPaths.has(path.toLowerCase());
  }

  /**
   * Check if a given URL matches any whitelisted path
   */
  isUrlWhitelisted(url?: string, hostname?: string, pathname?: string): boolean {
    // Use provided values or fall back to current window location
    const targetUrl = url || window.location.href;
    let targetHostname: string;
    let targetHostnameWithPort: string;
    
    // Get hostname and construct hostname with port for IP addresses
    if (hostname) {
      targetHostname = normalizeURL(hostname.toLowerCase());
      targetHostnameWithPort = targetHostname;
    } else {
      targetHostname = normalizeURL(window.location.hostname.toLowerCase());
      targetHostnameWithPort = targetHostname;
      // For IP addresses, include port if present
      const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetHostname);
      if (isIPAddress && window.location.port) {
        targetHostnameWithPort = `${targetHostname}:${window.location.port}`;
      }
    }
    
    // For whitelist matching, include search parameters if they exist in the whitelist entry
    let targetPathname: string;
    if (pathname !== undefined) {
      targetPathname = pathname.toLowerCase();
    } else {
      // Use pathname + search for more complete matching
      targetPathname = (window.location.pathname + window.location.search).toLowerCase();
    }
    
    logger.log('Checking whitelisted paths for', { hostname: targetHostname, pathname: targetPathname });
    
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
          hostname: targetHostname, 
          pathname: targetPathname 
        });
        
        // Check if domain matches and current path starts with whitelisted path
        // For IP addresses with ports in the whitelist, check hostname with port
        const domainMatch = (targetHostname === normalizedPathDomain) || 
                           (targetHostnameWithPort === normalizedPathDomain);
        
        if (domainMatch && targetPathname.startsWith(pathPath)) {
          if (this.isWhitelistedPathEnabled(whitelistedPath)) {
            logger.log('WHITELIST PATH MATCH FOUND (ENABLED)', { whitelistedPath, targetHostname, targetPathname });
            return true;
          } else {
            logger.log('WHITELIST PATH MATCH FOUND BUT DISABLED', { whitelistedPath, targetHostname, targetPathname });
          }
        }
      } else {
        // This is a domain-only whitelist entry
        const normalizedDomain = normalizeURL(whitelistedPath.toLowerCase());
        
        // Exact domain match (for subdomains in whitelist) - check both hostname and hostname with port
        const exactMatch = (targetHostname === normalizedDomain) || 
                          (targetHostnameWithPort === normalizedDomain);
        
        if (exactMatch) {
          if (this.isWhitelistedPathEnabled(whitelistedPath)) {
            logger.log('WHITELIST EXACT DOMAIN MATCH FOUND (ENABLED)', { targetHostname, targetHostnameWithPort, whitelistedPath: normalizedDomain });
            return true;
          } else {
            logger.log('WHITELIST EXACT DOMAIN MATCH FOUND BUT DISABLED', { targetHostname, targetHostnameWithPort, whitelistedPath: normalizedDomain });
          }
        }
        
        // NOTE: We DO NOT do subdomain matching for whitelisted entries
        // If user wants to whitelist music.youtube.com, they whitelist exactly that
        // This prevents youtube.com whitelist from affecting gaming.youtube.com
      }
    }
    
    logger.log('No whitelist match found');
    return false;
  }

  /**
   * Check if current URL matches any whitelisted path (legacy method)
   */
  isWhitelistedPath(): boolean {
    return this.isUrlWhitelisted();
  }


  /**
   * Check if a given URL should be blocked based on current rules
   */
  shouldUrlBeBlocked(url?: string, hostname?: string, pathname?: string): boolean {
    // Use provided values or fall back to current window location
    const targetUrl = url || window.location.href;
    let targetHostname: string;
    let targetHostnameWithPort: string;
    const targetPathname = pathname ? pathname.toLowerCase() : window.location.pathname.toLowerCase();
    
    // Get hostname and construct hostname with port for IP addresses
    if (hostname) {
      targetHostname = normalizeURL(hostname.toLowerCase());
      targetHostnameWithPort = targetHostname;
    } else {
      targetHostname = normalizeURL(window.location.hostname.toLowerCase());
      targetHostnameWithPort = targetHostname;
      // For IP addresses, include port if present
      const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetHostname);
      if (isIPAddress && window.location.port) {
        targetHostnameWithPort = `${targetHostname}:${window.location.port}`;
      }
    }
    
    logger.log('Checking URL', targetUrl);
    logger.log('Hostname', targetHostname);
    logger.log('Hostname with port', targetHostnameWithPort);
    logger.log('Pathname', targetPathname);
    logger.log('Against restricted sites', Array.from(this.restrictedSites));
    
    // First check if this path is whitelisted
    if (this.isUrlWhitelisted(targetUrl, hostname, pathname)) {
      logger.log('Site is whitelisted, not blocking');
      return false;
    }
    
    let shouldBlock = false;
    
    // Check each blocked site
    for (const site of this.restrictedSites) {
      logger.log('Comparing with', site);
      
      // Handle path-based blocking (like Reddit subreddits, YouTube channels)
      if (site.includes('/')) {
        const [siteDomain, ...pathParts] = site.split('/');
        const sitePath = ('/' + pathParts.join('/')).toLowerCase();
        const normalizedSiteDomain = normalizeURL(siteDomain.toLowerCase());
        
        logger.log('Path-based check', { siteDomain: normalizedSiteDomain, sitePath, hostname: targetHostname, pathname: targetPathname });
        
        // Check if domain matches and path starts with the blocked path
        // For IP addresses with ports in the blocked site, check hostname with port
        const domainMatch = (targetHostname === normalizedSiteDomain) || 
                           (targetHostnameWithPort === normalizedSiteDomain);
        
        if (domainMatch && targetPathname.startsWith(sitePath)) {
          if (this.isBlockedSiteEnabled(site)) {
            logger.log('PATH MATCH FOUND (ENABLED)', { site, targetHostname, targetPathname });
            shouldBlock = true;
            break;
          } else {
            logger.log('PATH MATCH FOUND BUT DISABLED', { site, targetHostname, targetPathname });
          }
        }
      } else {
        // Handle domain-based blocking
        const normalizedSite = normalizeURL(site.toLowerCase());
        
        // Exact domain match - check both hostname and hostname with port for IP addresses
        const exactMatch = (targetHostname === normalizedSite) || 
                          (targetHostnameWithPort === normalizedSite);
        
        if (exactMatch) {
          if (this.isBlockedSiteEnabled(site)) {
            logger.log('EXACT DOMAIN MATCH FOUND (ENABLED)', { targetHostname, targetHostnameWithPort, matchedSite: normalizedSite });
            shouldBlock = true;
            break;
          } else {
            logger.log('EXACT DOMAIN MATCH FOUND BUT DISABLED', { targetHostname, targetHostnameWithPort, matchedSite: normalizedSite });
          }
        }
        
        // Subdomain match (e.g., blocking "google.com" should block "mail.google.com")
        // BUT NOT if the specific subdomain is whitelisted
        if (targetHostname.endsWith('.' + normalizedSite)) {
          // Check if this specific subdomain is whitelisted
          if (!this.isSubdomainWhitelisted(targetHostname)) {
            if (this.isBlockedSiteEnabled(site)) {
              logger.log('SUBDOMAIN MATCH FOUND (ENABLED)', { targetHostname, matchedSite: normalizedSite });
              shouldBlock = true;
              break;
            } else {
              logger.log('SUBDOMAIN MATCH FOUND BUT DISABLED', { targetHostname, matchedSite: normalizedSite });
            }
          } else {
            logger.log('SUBDOMAIN BLOCKED BUT WHITELISTED', { targetHostname, matchedSite: normalizedSite });
          }
        }
        
        // Partial match for complex domains
        if (targetHostname.includes(normalizedSite)) {
          if (this.isBlockedSiteEnabled(site)) {
            logger.log('PARTIAL MATCH FOUND (ENABLED)', { targetHostname, matchedSite: normalizedSite });
            shouldBlock = true;
            break;
          } else {
            logger.log('PARTIAL MATCH FOUND BUT DISABLED', { targetHostname, matchedSite: normalizedSite });
          }
        }
      }
    }
    
    if (!shouldBlock) {
      logger.log('No match found');
    }
    
    return shouldBlock;
  }

  /**
   * Check if the current website should be blocked (legacy method)
   */
  shouldBlockWebsite(): boolean {
    return this.shouldUrlBeBlocked();
  }

  /**
   * Check if a specific subdomain is whitelisted
   */
  private isSubdomainWhitelisted(hostname: string): boolean {
    const normalizedHostname = normalizeURL(hostname.toLowerCase());
    
    for (const whitelistedPath of this.whitelistedPaths) {
      if (!whitelistedPath.includes('/')) {
        const normalizedWhitelisted = normalizeURL(whitelistedPath.toLowerCase());
        if (normalizedHostname === normalizedWhitelisted) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get site information for a given URL or current location
   */
  getSiteInfo(url?: string): { hostname: string; pathname: string; url: string } | null {
    try {
      if (url) {
        const urlObj = new URL(url);
        return {
          hostname: normalizeURL(urlObj.hostname.toLowerCase()),
          pathname: urlObj.pathname.toLowerCase(),
          url: url
        };
      } else {
        return {
          hostname: normalizeURL(window.location.hostname.toLowerCase()),
          pathname: window.location.pathname.toLowerCase(),
          url: window.location.href
        };
      }
    } catch (error) {
      logger.log('Error parsing URL and error:', { url, error });
      return null;
    }
  }

  /**
   * Get current site information for display (legacy method)
   */
  getCurrentSiteInfo(): { hostname: string; pathname: string; url: string } {
    const siteInfo = this.getSiteInfo();
    if (!siteInfo) {
      throw new Error('Unable to get current site info');
    }
    return siteInfo;
  }

  /**
   * Find a matching whitelist entry for a given URL
   */
  findMatchingWhitelistEntry(whitelistedPaths: string[], url?: string, hostname?: string, pathname?: string): string | null {
    let targetHostname: string;
    let targetPathname: string;
    
    if (url) {
      const siteInfo = this.getSiteInfo(url);
      if (!siteInfo) return null;
      targetHostname = siteInfo.hostname;
      targetPathname = siteInfo.pathname;
    } else if (hostname && pathname !== undefined) {
      targetHostname = normalizeURL(hostname.toLowerCase());
      targetPathname = pathname.toLowerCase();
    } else {
      const siteInfo = this.getSiteInfo();
      if (!siteInfo) return null;
      targetHostname = siteInfo.hostname;
      targetPathname = siteInfo.pathname;
    }
    
    // Remove www prefix for matching
    const cleanHostname = targetHostname.replace(/^www\./, '');
    
    for (const whitelistedPath of whitelistedPaths) {
      const pathLower = whitelistedPath.toLowerCase();
      
      if (pathLower.includes('/')) {
        // Path-specific whitelist
        const [pathDomain, ...pathParts] = pathLower.split('/');
        const pathPath = '/' + pathParts.join('/');
        const cleanPathDomain = pathDomain.replace(/^www\./, '');
        
        if (cleanHostname === cleanPathDomain && targetPathname.startsWith(pathPath)) {
          return whitelistedPath; // Return original case version
        }
      } else {
        // Domain-only whitelist
        const cleanPathLower = pathLower.replace(/^www\./, '');
        if (cleanHostname === cleanPathLower || cleanHostname.endsWith('.' + cleanPathLower)) {
          return whitelistedPath; // Return original case version
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a URL would be blocked by existing rules (includes both domain and path matching)
   */
  checkIfUrlWouldBeBlocked(blockedWebsites: string[], url?: string, hostname?: string): boolean {
    let targetHostname: string;
    let targetPathname: string;
    
    if (url) {
      const siteInfo = this.getSiteInfo(url);
      if (!siteInfo) return false;
      targetHostname = siteInfo.hostname;
      targetPathname = siteInfo.pathname;
    } else if (hostname) {
      targetHostname = normalizeURL(hostname.toLowerCase());
      targetPathname = window.location.pathname.toLowerCase();
    } else {
      const siteInfo = this.getSiteInfo();
      if (!siteInfo) return false;
      targetHostname = siteInfo.hostname;
      targetPathname = siteInfo.pathname;
    }
    
    // Remove www prefix for matching
    const cleanHostname = targetHostname.replace(/^www\./, '');
    
    for (const site of blockedWebsites) {
      const siteLower = site.toLowerCase();
      
      if (siteLower.includes('/')) {
        // Path-based block - check if target would be blocked by this rule
        const [siteDomain, ...pathParts] = siteLower.split('/');
        const sitePath = '/' + pathParts.join('/');
        const cleanSiteDomain = siteDomain.replace(/^www\./, '');
        
        if (cleanHostname === cleanSiteDomain && targetPathname.startsWith(sitePath)) {
          return true;
        }
      } else {
        // Domain-based block - check if current page would be blocked
        const cleanSite = siteLower.replace(/^www\./, '');
        if (cleanHostname === cleanSite || cleanHostname.endsWith('.' + cleanSite)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a URL is whitelisted
   */
  checkIfUrlIsWhitelisted(whitelistedPaths: string[], url?: string, hostname?: string, pathname?: string): boolean {
    return this.findMatchingWhitelistEntry(whitelistedPaths, url, hostname, pathname) !== null;
  }
}