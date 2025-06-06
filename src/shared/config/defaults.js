/**
 * Default configuration settings for the extension
 */

export const DEFAULT_SETTINGS = {
  blockMode: 'block', // 'block' or 'redirect'
  redirectUrl: 'https://www.google.com',
  redirectDelay: 3, // seconds
  extensionEnabled: true,
  debugEnabled: false
};

export const DEFAULT_BLOCKED_WEBSITES = [];

export const DEFAULT_WHITELISTED_PATHS = [];

export const VALIDATION_RULES = {
  redirectDelay: {
    min: 0,
    max: 30
  },
  maxBlockedSites: 1000,
  maxWhitelistedPaths: 500
};