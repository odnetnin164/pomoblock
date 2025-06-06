/**
 * Whitelist checking functionality
 */

import { normalizeURL } from '../shared/utils/url-utils.js';
import { debugLog } from '../shared/utils/debug.js';

export class WhitelistChecker {
  constructor(whitelistedPaths = []) {
    this.whitelistedPaths = new Set(whitelistedPaths.map(path => path.toLowerCase()));
  }

  /**
   * Update whitelisted paths
   * @param {Array} paths - Array of whitelisted paths
   */
  updatePaths(paths) {
    this.whitelistedPaths = new Set(paths.map(path => path.toLowerCase()));
    debugLog('Whitelisted paths updated', Array.from(this.whitelistedPaths));
  }

  /**
   * Check if current URL matches any whitelisted path
   * @returns {boolean} True if whitelisted
   */
  isWhitelisted() {
    const currentUrl = window.location.href;
    const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
    const currentPathname = window.location.pathname.toLowerCase();
    
    debugLog('Checking whitelisted paths for', { currentHostname, currentPathname });
    
    for (const whitelistedPath of this.whitelistedPaths) {
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
}