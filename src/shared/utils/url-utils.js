/**
 * URL utility functions shared across the extension
 */

/**
 * Normalize URL by removing 'www.' from the beginning
 * @param {string} url - The URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeURL(url) {
  return url.replace(/^www\./i, "");
}

/**
 * Clean and normalize URL input for consistent storage
 * @param {string} url - Raw URL input
 * @returns {string} Cleaned URL
 */
export function cleanURL(url) {
  // Convert to lowercase for consistent handling
  url = url.toLowerCase();
  
  // Handle special cases for paths (Reddit subreddits, YouTube channels, etc.)
  if (url.includes('reddit.com/r/')) {
    // Extract subreddit path
    const match = url.match(/reddit\.com\/r\/([^\/\?\#]+)/);
    if (match) {
      return `reddit.com/r/${match[1]}`;
    }
  }
  
  if (url.includes('youtube.com/')) {
    // Extract channel path
    const channelMatch = url.match(/youtube\.com\/(c|channel|user)\/([^\/\?\#]+)/);
    if (channelMatch) {
      return `youtube.com/${channelMatch[1]}/${channelMatch[2]}`;
    }
  }
  
  if (url.includes('twitter.com/') || url.includes('x.com/')) {
    // Extract user profile
    const domain = url.includes('twitter.com') ? 'twitter.com' : 'x.com';
    const userMatch = url.match(new RegExp(`${domain.replace('.', '\\.')}\\/([^\\/\\?\\#]+)`));
    if (userMatch && !isReservedPath(userMatch[1])) {
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
 * Check if a path is reserved (shouldn't be treated as a username)
 * @param {string} path - The path to check
 * @returns {boolean} True if reserved
 */
function isReservedPath(path) {
  const reservedPaths = [
    'home', 'explore', 'notifications', 'messages', 'bookmarks', 
    'lists', 'profile', 'settings', 'login', 'signup', 'about'
  ];
  return reservedPaths.includes(path.toLowerCase());
}

/**
 * Validate if a string is a valid domain
 * @param {string} input - Domain to validate
 * @returns {boolean} True if valid
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
 * Validate if a string is a valid URL
 * @param {string} string - URL to validate
 * @returns {boolean} True if valid
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
 * @param {string} hostname - The hostname
 * @param {string} pathname - The pathname
 * @returns {string|null} The target to block or null if cannot block
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
    if (userMatch && !isReservedPath(userMatch[1])) {
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
 * Determine the best whitelist target (priority: specific path > subdomain > domain)
 * @param {string} hostname - Current hostname
 * @param {string} pathname - Current pathname
 * @returns {string} The suggested whitelist target
 */
export function determineWhitelistTarget(hostname, pathname) {
  const currentHostname = normalizeURL(hostname.toLowerCase());
  const currentPathname = pathname.toLowerCase();
  
  // Priority 1: If we're on a specific path, suggest whitelisting the path
  if (currentPathname !== '/' && currentPathname.length > 1) {
    // Special handling for known sites with meaningful paths
    if (currentHostname === 'reddit.com' && currentPathname.startsWith('/r/')) {
      const subredditMatch = currentPathname.match(/^\/r\/([^\/]+)/);
      if (subredditMatch) {
        return `reddit.com/r/${subredditMatch[1]}`;
      }
    }
    
    if (currentHostname === 'youtube.com') {
      const channelMatch = currentPathname.match(/^\/(c|channel|user)\/([^\/]+)/);
      if (channelMatch) {
        return `youtube.com/${channelMatch[1]}/${channelMatch[2]}`;
      }
    }
    
    if ((currentHostname === 'twitter.com' || currentHostname === 'x.com')) {
      const userMatch = currentPathname.match(/^\/([^\/]+)$/);
      if (userMatch && !isReservedPath(userMatch[1])) {
        return `${currentHostname}/${userMatch[1]}`;
      }
    }
    
    // For other sites with meaningful paths, suggest the first path segment
    const pathSegments = currentPathname.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length > 0) {
      return `${currentHostname}/${pathSegments[0]}`;
    }
  }
  
  // Priority 2: If subdomain, suggest whitelisting the subdomain
  const parts = currentHostname.split('.');
  if (parts.length > 2) {
    return currentHostname;
  }
  
  // Priority 3: Fallback to domain
  return currentHostname;
}