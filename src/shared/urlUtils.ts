import { SiteType, SiteInfo } from './types';
import { SUBDOMAIN_PRESERVE_LIST, SOCIAL_SYSTEM_PAGES } from './constants';

/**
 * Normalize URL by removing 'www.' from the beginning
 */
export function normalizeURL(url: string): string {
  return url.replace(/^www\./i, '');
}

/**
 * Clean and normalize URL input for storage
 */
export function cleanURL(url: string): string {
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
    if (userMatch && !SOCIAL_SYSTEM_PAGES.includes(userMatch[1])) {
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
 * Validate domain format
 */
export function isValidDomain(input: string): boolean {
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
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate path for whitelist (should include domain and path)
 */
export function isValidPath(input: string): boolean {
  return isValidDomain(input);
}

/**
 * Get site type for display purposes
 */
export function getSiteType(site: string): SiteType | null {
  if (site.includes('reddit.com/r/')) {
    return 'Subreddit';
  }
  if (site.includes('youtube.com/') && (site.includes('/c/') || site.includes('/channel/') || site.includes('/user/'))) {
    return 'Channel';
  }
  if ((site.includes('twitter.com/') || site.includes('x.com/')) && site.split('/').length === 2) {
    return 'Profile';
  }
  if (site.includes('/')) {
    return 'Path';
  }
  if (site.split('.').length > 2) {
    return 'Subdomain';
  }
  return 'Domain';
}

/**
 * Parse URL and return site information
 */
export function parseSiteInfo(url: string): SiteInfo {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    const normalizedUrl = cleanURL(url);
    
    return {
      url,
      hostname,
      pathname,
      normalizedUrl,
      type: getSiteType(normalizedUrl)
    };
  } catch {
    // Fallback for invalid URLs
    const cleanedUrl = cleanURL(url);
    return {
      url,
      hostname: cleanedUrl.split('/')[0],
      pathname: '/',
      normalizedUrl: cleanedUrl,
      type: getSiteType(cleanedUrl)
    };
  }
}

/**
 * Determine what should be blocked based on hostname and pathname
 */
export function determineBlockTarget(hostname: string, pathname: string): string | null {
  // Skip chrome:// and extension pages
  if (hostname.startsWith('chrome') || hostname.includes('extension')) {
    return null;
  }

  const cleanHostname = normalizeURL(hostname.toLowerCase());
  const cleanPathname = pathname.toLowerCase();
  
  // Special handling for Reddit - block specific subreddits
  if (cleanHostname === 'reddit.com') {
    const subredditMatch = cleanPathname.match(/^\/r\/([^\/]+)/i);
    if (subredditMatch) {
      return `reddit.com/r/${subredditMatch[1].toLowerCase()}`;
    }
    return 'reddit.com';
  }
  
  // Special handling for YouTube - could block specific channels
  if (cleanHostname === 'youtube.com') {
    const channelMatch = cleanPathname.match(/^\/(c|channel|user)\/([^\/]+)/i);
    if (channelMatch) {
      return `youtube.com/${channelMatch[1].toLowerCase()}/${channelMatch[2].toLowerCase()}`;
    }
    return 'youtube.com';
  }
  
  // Special handling for Twitter/X - could block specific users
  if (cleanHostname === 'twitter.com' || cleanHostname === 'x.com') {
    const userMatch = cleanPathname.match(/^\/([^\/]+)$/i);
    if (userMatch && !SOCIAL_SYSTEM_PAGES.includes(userMatch[1].toLowerCase())) {
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
    if (SUBDOMAIN_PRESERVE_LIST.includes(subdomain)) {
      return cleanHostname;
    }
    
    // For most other subdomains, block the main domain
    return mainDomain;
  }
  
  // Default: block the cleaned hostname
  return cleanHostname;
}

/**
 * Get user-friendly label for block/whitelist target
 */
export function getTargetLabel(target: string): string {
  if (target.includes('reddit.com/r/')) {
    const subreddit = target.split('/r/')[1];
    return `r/${subreddit} subreddit`;
  }
  
  if (target.includes('youtube.com/channel/') || target.includes('youtube.com/c/')) {
    return 'this YouTube channel';
  }
  
  if (target.includes('youtube.com/user/')) {
    return 'this YouTube user';
  }
  
  if ((target.includes('twitter.com/') || target.includes('x.com/')) && target.split('/').length === 2) {
    const username = target.split('/')[1];
    return `@${username} profile`;
  }
  
  if (target.includes('/')) {
    const pathPart = target.split('/').slice(1).join('/');
    return `${target.split('/')[0]}/${pathPart} section`;
  }
  
  const parts = target.split('.');
  if (parts.length > 2) {
    return `${parts[0]} subdomain`;
  }
  
  return `${target} domain`;
}