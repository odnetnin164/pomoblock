/**
 * Site detection utilities for identifying special sites and their types
 */

/**
 * Check if this is a special site that needs different handling
 * @param {string} hostname - The hostname to check
 * @returns {boolean} True if it's a special site
 */
export function isSpecialSite(hostname) {
  const specialSites = ['reddit.com', 'youtube.com', 'twitter.com', 'x.com'];
  return specialSites.some(site => hostname.includes(site));
}

/**
 * Get site type for display purposes
 * @param {string} site - The site/path string
 * @returns {string|null} The site type or null
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
 * @param {string} path - The path string
 * @returns {string} The path type
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
 * Get user-friendly label for whitelist target
 * @param {string} target - The whitelist target
 * @returns {string} Human-readable label
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