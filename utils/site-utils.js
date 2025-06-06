// Site utilities for the PomoBlock extension
import { SPECIAL_SITES } from './constants.js';

/**
 * Get site type for display purposes
 */
export function getSiteType(site) {
  if (site.includes('reddit.com/r/')) {
    return 'Subreddit';
  }
  if (site.includes('youtube.com/') && (site.includes('/c/') || site.includes('/channel/') || site.includes('/user/'))) {
    return 'Channel';
  }
  if ((site.includes('twitter.com/') || site.includes('x.com/')) && site.split('/').length === 2) {
    return 'Profile';
  }
  if (site.split('.').length > 2) {
    return 'Subdomain';
  }
  return null;
}

/**
 * Get path type for display (for whitelist)
 */
export function getPathType(path) {
  if (path.includes('reddit.com/r/')) {
    return 'Subreddit';
  }
  if (path.includes('youtube.com/') && (path.includes('/c/') || path.includes('/channel/') || path.includes('/user/'))) {
    return 'Channel';
  }
  if ((path.includes('twitter.com/') || path.includes('x.com/')) && path.split('/').length === 2) {
    return 'Profile';
  }
  if (path.includes('/')) {
    return 'Path';
  }
  return 'Domain';
}

/**
 * Check if this is a special site that needs different handling
 */
export function isSpecialSite(hostname) {
  const specialSites = Object.values(SPECIAL_SITES);
  return specialSites.some(site => hostname.includes(site));
}

/**
 * Determine the best whitelist target (priority: specific path > subdomain > domain)
 */
export function determineWhitelistTarget(hostname, pathname) {
  const currentHostname = hostname.replace(/^www\./, '').toLowerCase();
  const currentPathname = pathname.toLowerCase();
  
  // Priority 1: If we're on a specific path, suggest whitelisting the path
  if (currentPathname !== '/' && currentPathname.length > 1) {
    // Special handling for known sites with meaningful paths
    if (currentHostname === SPECIAL_SITES.REDDIT && currentPathname.startsWith('/r/')) {
      const subredditMatch = currentPathname.match(/^\/r\/([^\/]+)/);
      if (subredditMatch) {
        return `reddit.com/r/${subredditMatch[1]}`;
      }
    }
    
    if (currentHostname === SPECIAL_SITES.YOUTUBE) {
      const channelMatch = currentPathname.match(/^\/(c|channel|user)\/([^\/]+)/);
      if (channelMatch) {
        return `youtube.com/${channelMatch[1]}/${channelMatch[2]}`;
      }
    }
    
    if ((currentHostname === SPECIAL_SITES.TWITTER || currentHostname === SPECIAL_SITES.X)) {
      const userMatch = currentPathname.match(/^\/([^\/]+)$/);
      if (userMatch && !['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'settings'].includes(userMatch[1])) {
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

/**
 * Get user-friendly label for whitelist target
 */
export function getWhitelistLabel(target) {
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