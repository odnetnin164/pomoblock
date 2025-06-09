// src/shared/constants.ts
import { ExtensionSettings, WorkHours } from './types';

// Default Pomodoro Settings (defined here to avoid circular imports)
const DEFAULT_POMODORO_SETTINGS = {
  workDuration: 25,
  restDuration: 5,
  longRestDuration: 15,
  longRestInterval: 4,
  autoStartRest: false,
  autoStartWork: false,
  showNotifications: true,
  playSound: true
};

// Default Work Hours Settings
export const DEFAULT_WORK_HOURS: WorkHours = {
  enabled: false,
  startTime: '09:00',
  endTime: '17:00',
  days: [1, 2, 3, 4, 5] // Monday to Friday
};

// Default Extension Settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  blockMode: 'block',
  redirectUrl: 'https://www.google.com',
  redirectDelay: 3,
  extensionEnabled: true,
  debugEnabled: false,
  workHours: DEFAULT_WORK_HOURS,
  pomodoro: DEFAULT_POMODORO_SETTINGS
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

// Work Hours Configuration
export const WORK_HOURS_CONFIG = {
  DAYS_OF_WEEK: [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' }
  ],
  TIME_PRESETS: [
    { start: '08:00', end: '17:00', label: '8 AM - 5 PM' },
    { start: '09:00', end: '17:00', label: '9 AM - 5 PM' },
    { start: '09:00', end: '18:00', label: '9 AM - 6 PM' },
    { start: '10:00', end: '18:00', label: '10 AM - 6 PM' },
    { start: '08:00', end: '16:00', label: '8 AM - 4 PM' }
  ]
};

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
  DEBUG_ENABLED: 'debugEnabled',
  WORK_HOURS_ENABLED: 'workHoursEnabled',
  WORK_HOURS_START_TIME: 'workHoursStartTime',
  WORK_HOURS_END_TIME: 'workHoursEndTime',
  WORK_HOURS_DAYS: 'workHoursDays'
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