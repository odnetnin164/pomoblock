/**
 * Site-specific constants and patterns
 */

export const SPECIAL_SITES = [
  'reddit.com',
  'youtube.com', 
  'twitter.com',
  'x.com'
];

export const RESERVED_PATHS = [
  'home', 'explore', 'notifications', 'messages', 'bookmarks',
  'lists', 'profile', 'settings', 'login', 'signup', 'about',
  'help', 'support', 'terms', 'privacy', 'contact'
];

export const SUBDOMAIN_SPECIFIC_SITES = [
  'mail', 'drive', 'docs', 'sheets', 'slides', 'forms',
  'calendar', 'photos', 'maps', 'translate'
];

export const SITE_PATTERNS = {
  REDDIT_SUBREDDIT: /^\/r\/([^\/]+)/i,
  YOUTUBE_CHANNEL: /^\/(c|channel|user)\/([^\/]+)/i,
  TWITTER_USER: /^\/([^\/]+)$/i,
  DOMAIN_ONLY: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/
};

export const COMMON_REDIRECT_URLS = [
  'https://www.google.com',
  'https://www.github.com',
  'https://www.wikipedia.org',
  'https://www.duolingo.com',
  'https://www.khanacademy.org'
];