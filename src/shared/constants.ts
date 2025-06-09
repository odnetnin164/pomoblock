import { ExtensionSettings } from './types';

// Default Extension Settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  blockMode: 'block',
  redirectUrl: 'https://www.google.com',
  redirectDelay: 3,
  extensionEnabled: true,
  debugEnabled: false
};

// Suggested Redirect URLs
export const SUGGESTED_REDIRECT_URLS = [
  { url: 'https://www.google.com', label: 'Google' },
  { url: 'https://www.github.com', label: 'GitHub' },
  { url: 'https://www.wikipedia.org', label: 'Wikipedia' },
  { url: 'https://www.duolingo.com', label: 'Duolingo' },
  { url: 'https://www.khanacademy.org', label: 'Khan Academy' }
];

// Redirect Delay Presets
export const DELAY_PRESETS = [
  { value: 0, label: 'Instant' },
  { value: 1, label: '1s' },
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' }
];

// Special Sites Configuration
export const SPECIAL_SITES = ['reddit.com', 'youtube.com', 'twitter.com', 'x.com'];

// Sites that should preserve subdomain blocking
export const SUBDOMAIN_PRESERVE_LIST = [
  'mail', 'drive', 'docs', 'sheets', 'slides', 'forms'
];

// Non-user pages for social media
export const SOCIAL_SYSTEM_PAGES = [
  'home', 'explore', 'notifications', 'messages', 
  'bookmarks', 'lists', 'profile', 'settings'
];

// Storage Keys
export const STORAGE_KEYS = {
  BLOCKED_WEBSITES: 'blockedWebsitesArray',
  WHITELISTED_PATHS: 'whitelistedPathsArray',
  BLOCK_MODE: 'blockMode',
  REDIRECT_URL: 'redirectUrl',
  REDIRECT_DELAY: 'redirectDelay',
  EXTENSION_ENABLED: 'extensionEnabled',
  DEBUG_ENABLED: 'debugEnabled'
} as const;

// Debug Configuration
export const DEBUG_CONFIG = {
  MAX_LOG_ENTRIES: 10,
  DEBUG_DIV_ID: 'siteblocker-debug',
  AUTO_HIDE_DELAY: 5000
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  SUCCESS_DISPLAY_DURATION: 2000,
  STATUS_MESSAGE_DURATION: 5000,
  BUTTON_COOLDOWN: 1000
};

// Extension Metadata
export const EXTENSION_INFO = {
  NAME: 'PomoBlock',
  VERSION: '0.1.0',
  DESCRIPTION: 'Block access to distracting websites and stay focused on what matters most.'
};