// Whitelist checking utilities for content script
import { normalizeURL } from '../utils/url-utils.js';
import { debugLog } from './debug.js';

/**
 * Check if current URL matches any whitelisted path
 */
export function isWhitelistedPath(whitelistedPaths) {
  const currentUrl = window.location.href;
  const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
  const currentPathname = window.location.pathname.toLowerCase();
  
  debugLog('Checking whitelisted paths for', { currentHostname, currentPathname });
  
  for (const whitelistedPath of whitelistedPaths) {
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