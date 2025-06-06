// Shared constants for the PomoBlock extension

export const SPECIAL_SITES = {
  REDDIT: 'reddit.com',
  YOUTUBE: 'youtube.com', 
  TWITTER: 'twitter.com',
  X: 'x.com'
};

export const PROTECTED_PATHS = ['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'settings'];

export const SUBDOMAIN_TYPES = {
  GOOGLE: ['mail', 'drive', 'docs', 'sheets', 'slides', 'forms'],
  BLOCK_SPECIFIC: true
};

export const DEFAULT_SETTINGS = {
  blockMode: 'block',
  redirectUrl: 'https://www.google.com',
  redirectDelay: 3,
  extensionEnabled: true,
  debugEnabled: false
};

export const URL_SUGGESTIONS = [
  { label: 'Google', url: 'https://www.google.com' },
  { label: 'GitHub', url: 'https://www.github.com' },
  { label: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { label: 'Duolingo', url: 'https://www.duolingo.com' },
  { label: 'Khan Academy', url: 'https://www.khanacademy.org' }
];

export const DELAY_PRESETS = [
  { label: 'Instant', value: 0 },
  { label: '1s', value: 1 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 }
];

export const STORAGE_KEYS = {
  BLOCKED_WEBSITES: 'blockedWebsitesArray',
  WHITELISTED_PATHS: 'whitelistedPathsArray',
  BLOCK_MODE: 'blockMode',
  REDIRECT_URL: 'redirectUrl',
  REDIRECT_DELAY: 'redirectDelay',
  EXTENSION_ENABLED: 'extensionEnabled',
  DEBUG_ENABLED: 'debugEnabled'
};