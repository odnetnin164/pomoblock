// URL utilities for the PomoBlock extension
import { SPECIAL_SITES, PROTECTED_PATHS } from './constants.js';

/**
 * Normalize URL by removing 'www.' from the beginning
 */
export function normalizeURL(url) {
  return url.replace(/^www\./i, "");
}

/**
 * Clean and normalize URL input for blocking/whitelisting
 */
export function cleanURL(url) {
  // Convert to lowercase for consistent handling
  url = url.toLowerCase();
  
  // Handle special cases for paths (Reddit subreddits, YouTube channels, etc.)
  if (url.includes('reddit.com/r/')) {
    const match = url.match(/reddit\.com\/r\/([^\/\?\#]+)/);
    if (match) {
      return `reddit.com/r/${match[1]}`;
    }
  }
  
  if (url.includes('youtube.com/')) {
    const channelMatch = url.match(/youtube\.com\/(c|channel|user)\/([^\/\?\#]+)/);
    if (channelMatch) {
      return `youtube.com/${channelMatch[1]}/${channelMatch[2]}`;
    }
  }
  
  if (url.includes('twitter.com/') || url.includes('x.com/')) {
    const domain = url.includes('twitter.com') ? 'twitter.com' : 'x.com';
    const userMatch = url.match(new RegExp(`${domain.replace('.', '\\.')}\\/([^\/\\?\\#]+)`));
    if (userMatch && !PROTECTED_PATHS.includes(userMatch[1])) {
      return `${domain}/${userMatch[1]}`;
    }
  }
  
  // For regular domains, remove protocol, www, path, etc.
  let cleanUrl = url;
  cleanUrl = cleanUrl.replace(/^https?:\/\//, '');
  cleanUrl = cleanUrl.replace(/^www\./, '');
  cleanUrl = cleanUrl.split(':')[0];
  cleanUrl = cleanUrl.split('?')[0];
  cleanUrl = cleanUrl.split('#')[0];
  
  return cleanUrl;
}

/**
 * Enhanced domain validation that supports paths
 */
export function isValidDomain(input) {
  // Check for paths (Reddit, YouTube, Twitter)
  if (input.includes('/')) {
    const parts = input.split('/');
    const domain = parts[0];
    const path = parts.slice(1).join('/');
    
    // Validate domain part
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
    if (!domainRegex.test(domain) || !domain.includes('.')) {
      return false;
    }
    
    // Validate path part (basic check)
    if (path.length === 0) {
      return false;
    }
    
    return true;
  }
  
  // Regular domain validation
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
  return domainRegex.test(input) && input.includes('.');
}

/**
 * Validate URL format
 */
export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Determine what should be blocked based on hostname and pathname
 */
export function determineBlockTarget(hostname, pathname) {
  // Skip chrome:// and extension pages
  if (hostname.startsWith('chrome') || hostname.includes('extension')) {
    return null;
  }

  // Remove www. prefix and convert to lowercase for consistent comparison
  const cleanHostname = hostname.replace(/^www\./, '').toLowerCase();
  const cleanPathname = pathname.toLowerCase();
  
  // Special handling for Reddit - block specific subreddits
  if (cleanHostname === SPECIAL_SITES.REDDIT) {
    const subredditMatch = cleanPathname.match(/^\/r\/([^\/]+)/i);
    if (subredditMatch) {
      return `reddit.com/r/${subredditMatch[1].toLowerCase()}`;
    }
    return 'reddit.com';
  }
  
  // Special handling for YouTube - could block specific channels
  if (cleanHostname === SPECIAL_SITES.YOUTUBE) {
    const channelMatch = cleanPathname.match(/^\/(c|channel|user)\/([^\/]+)/i);
    if (channelMatch) {
      return `youtube.com/${channelMatch[1].toLowerCase()}/${channelMatch[2].toLowerCase()}`;
    }
    return 'youtube.com';
  }
  
  // Special handling for Twitter/X - could block specific users
  if (cleanHostname === SPECIAL_SITES.TWITTER || cleanHostname === SPECIAL_SITES.X) {
    const userMatch = cleanPathname.match(/^\/([^\/]+)$/i);
    if (userMatch && !PROTECTED_PATHS.includes(userMatch[1].toLowerCase())) {
      return `${cleanHostname}/${userMatch[1].toLowerCase()}`;
    }
    return cleanHostname;
  }
  
  // For subdomains, decide whether to block subdomain or main domain
  const parts = cleanHostname.split('.');
  if (parts.length > 2) {
    const mainDomain = parts.slice(-2).join('.');
    const subdomain = parts[0].toLowerCase();
    
    // Block subdomain specifically for certain cases
    if (['mail', 'drive', 'docs', 'sheets', 'slides', 'forms'].includes(subdomain)) {
      return cleanHostname;
    }
    
    // For most other subdomains, block the main domain
    return mainDomain;
  }
  
  // Default: block the cleaned hostname
  return cleanHostname;
}

/**
 * Parse URL and extract hostname and pathname
 */
export function parseURL(url) {
  try {
    const urlObj = new URL(url);
    return {
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      normalized: normalizeURL(urlObj.hostname.toLowerCase()),
      cleanPathname: urlObj.pathname.toLowerCase()
    };
  } catch (error) {
    return null;
  }
}