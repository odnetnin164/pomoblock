import { SiteType, SiteInfo, BlockOption, BlockType } from './types';
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

/**
 * Generate block options for a given URL
 */
export function generateBlockOptions(url: string): BlockOption[] {
  try {
    const urlObj = new URL(url);
    const hostname = normalizeURL(urlObj.hostname.toLowerCase());
    const pathname = urlObj.pathname;
    const fullPath = hostname + pathname;
    
    const options: BlockOption[] = [];
    
    // Check if hostname is an IP address
    const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    
    // Get domain parts (only for non-IP addresses)
    const domainParts = hostname.split('.');
    const isSubdomain = !isIPAddress && domainParts.length > 2;
    const mainDomain = isIPAddress ? hostname : (isSubdomain ? domainParts.slice(-2).join('.') : hostname);
    
    // Option 1: Block entire domain/IP address
    if (isIPAddress) {
      // For IP addresses, provide 4 specific options:
      
      // 1) The whole IP (without port)
      options.push({
        type: 'domain',
        label: `Entire ${hostname} server`,
        target: hostname,
        description: `Blocks all pages and ports on ${hostname}`
      });
      
      // 2) The IP with the port (if port exists)
      if (urlObj.port) {
        const ipWithPort = `${hostname}:${urlObj.port}`;
        options.push({
          type: 'domain',
          label: `${ipWithPort} (this port only)`,
          target: ipWithPort,
          description: `Blocks only ${ipWithPort}, other ports remain accessible`
        });
      }
      
      // 3) The IP with path (if path exists) - use n-1 segments
      if (pathname && pathname !== '/') {
        const pathSegments = pathname.split('/').filter(segment => segment.length > 0);
        if (pathSegments.length > 1) {
          // Block first n-1 segments (leave out the last segment)
          const blockedSegments = pathSegments.slice(0, -1);
          const blockedPath = `/${blockedSegments.join('/')}`;
          let ipWithPath;
          let description;
          
          if (urlObj.port) {
            // IP with explicit port and path
            ipWithPath = `${hostname}:${urlObj.port}${blockedPath}`;
            description = `Blocks only the ${blockedPath} section on ${hostname}:${urlObj.port}`;
          } else {
            // IP with default port and path
            ipWithPath = `${hostname}${blockedPath}`;
            description = `Blocks only the ${blockedPath} section on ${hostname}`;
          }
          
          options.push({
            type: 'path',
            label: `${ipWithPath} section`,
            target: ipWithPath,
            description: description
          });
        }
      }
    } else {
      options.push({
        type: 'domain',
        label: `Entire ${mainDomain} domain`,
        target: mainDomain,
        description: `Blocks ${mainDomain} and all its subdomains`
      });
      
      // Option 2: Block specific subdomain (if applicable)
      if (isSubdomain) {
        options.push({
          type: 'subdomain',
          label: `${hostname} subdomain only`,
          target: hostname,
          description: `Blocks only ${hostname}, not other subdomains`
        });
      }
    }
    
    // Special handling for Reddit subreddits
    if (hostname === 'reddit.com' && pathname.includes('/r/')) {
      const subredditMatch = pathname.match(/^\/r\/([^\/]+)/);
      if (subredditMatch) {
        const subreddit = subredditMatch[1];
        options.push({
          type: 'path',
          label: `r/${subreddit} subreddit`,
          target: `reddit.com/r/${subreddit}`,
          description: `Blocks only the r/${subreddit} subreddit`
        });
      }
    }
    // Special handling for YouTube channels
    else if (hostname === 'youtube.com' && pathname.match(/^\/(c|channel|user)\//)) {
      const channelMatch = pathname.match(/^\/(c|channel|user)\/([^\/]+)/);
      if (channelMatch) {
        const channelType = channelMatch[1];
        const channelName = channelMatch[2];
        options.push({
          type: 'path',
          label: `This YouTube ${channelType === 'c' ? 'channel' : channelType}`,
          target: `youtube.com/${channelType}/${channelName}`,
          description: `Blocks only this YouTube ${channelType === 'c' ? 'channel' : channelType}`
        });
      }
    }
    // Special handling for Twitter/X profiles
    else if ((hostname === 'twitter.com' || hostname === 'x.com') && pathname.match(/^\/[^\/]+$/)) {
      const userMatch = pathname.match(/^\/([^\/]+)$/);
      if (userMatch && !SOCIAL_SYSTEM_PAGES.includes(userMatch[1].toLowerCase())) {
        const username = userMatch[1];
        options.push({
          type: 'path',
          label: `@${username} profile`,
          target: `${hostname}/${username}`,
          description: `Blocks only @${username}'s profile`
        });
      }
    }
    // Generic path handling for other sites (not IP addresses)
    else if (!isIPAddress && pathname && pathname !== '/' && pathname.length > 1) {
      // Clean up pathname for display
      const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      const pathSegments = cleanPath.split('/').filter(segment => segment.length > 0);
      
      // Generate path options from shortest to longest
      if (pathSegments.length > 0) {
        // Option for first path segment (e.g., /browse for /browse/staff-picks/post/123)
        const shortPath = `/${pathSegments[0]}`;
        const shortTarget = `${hostname}${shortPath}`;
        
        options.push({
          type: 'path',
          label: `${shortTarget} section`,
          target: shortTarget,
          description: `Blocks the ${shortPath} section of the site`
        });
        
        // If there are multiple path segments, also add the full path option
        if (pathSegments.length > 1) {
          const fullTarget = `${hostname}${cleanPath}`;
          
          options.push({
            type: 'path',
            label: `${fullTarget} path`,
            target: fullTarget,
            description: `Blocks only this specific path`
          });
        }
      }
    }
    
    // Option 4: Block specific page (full URL path)  
    if (pathname && pathname !== '/') {
      // Use full URL with query parameters but without fragments
      const fullUrl = urlObj.href.split('#')[0]; // Remove fragment but keep query params
      let displayPath;
      let description;
      
      if (isIPAddress) {
        // For IP addresses, construct the path with query parameters
        const pathWithQuery = pathname + urlObj.search;
        
        if (urlObj.port) {
          displayPath = `${hostname}:${urlObj.port}${pathWithQuery}`;
          description = `Blocks only this exact page on ${hostname}:${urlObj.port}`;
        } else {
          displayPath = `${hostname}${pathWithQuery}`;
          description = `Blocks only this exact page on ${hostname}`;
        }
      } else {
        // For regular domains, use the full URL approach
        displayPath = fullUrl.replace(/^https?:\/\//, '');
        description = `Blocks only this exact page`;
      }
      
      options.push({
        type: 'page',
        label: 'This specific page',
        target: displayPath,
        description: description
      });
    }
    
    return options;
  } catch (error) {
    // Fallback for invalid URLs
    return [{
      type: 'domain',
      label: 'Invalid URL',
      target: '',
      description: 'Cannot parse this URL'
    }];
  }
}

/**
 * Generate subdomain whitelist options for a given URL
 */
export function generateSubdomainWhitelistOptions(url: string, blockedDomains: string[]): BlockOption[] {
  try {
    const urlObj = new URL(url);
    const hostname = normalizeURL(urlObj.hostname.toLowerCase());
    const domainParts = hostname.split('.');
    
    const options: BlockOption[] = [];
    
    if (domainParts.length > 2) {
      const mainDomain = domainParts.slice(-2).join('.');
      const subdomain = hostname;
      
      // Check if the main domain is blocked
      const isDomainBlocked = blockedDomains.some(blocked => {
        const normalizedBlocked = normalizeURL(blocked.toLowerCase());
        return normalizedBlocked === mainDomain;
      });
      
      if (isDomainBlocked) {
        options.push({
          type: 'subdomain',
          label: `Whitelist ${subdomain}`,
          target: subdomain,
          description: `Allow ${subdomain} while keeping ${mainDomain} blocked`
        });
      }
    }
    
    return options;
  } catch (error) {
    return [];
  }
}