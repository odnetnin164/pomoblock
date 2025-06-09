// Extension Settings Types
export interface ExtensionSettings {
  blockMode: 'block' | 'redirect';
  redirectUrl: string;
  redirectDelay: number;
  extensionEnabled: boolean;
  debugEnabled: boolean;
}

// Storage Data Types
export interface StorageData {
  blockedWebsitesArray?: string[];
  whitelistedPathsArray?: string[];
  blockMode?: 'block' | 'redirect';
  redirectUrl?: string;
  redirectDelay?: number;
  extensionEnabled?: boolean;
  debugEnabled?: boolean;
}

// Site Types
export type SiteType = 'Subreddit' | 'Channel' | 'Profile' | 'Subdomain' | 'Path' | 'Domain';

export interface SiteInfo {
  url: string;
  type: SiteType | null;
  hostname: string;
  pathname: string;
  normalizedUrl: string;
}

// UI Status Types
export type StatusMessageType = 'success' | 'error' | 'info';

export interface StatusMessage {
  text: string;
  type: StatusMessageType;
  duration?: number;
}

// Block Target Information
export interface BlockTarget {
  target: string;
  label: string;
  isSpecialSite: boolean;
  isWhitelisted: boolean;
  isBlocked: boolean;
}

// Whitelist Target Information
export interface WhitelistTarget {
  target: string;
  label: string;
}

// Debug Log Entry
export interface DebugLogEntry {
  timestamp: Date;
  message: string;
  data?: any;
}

// Content Script Message Types
export type ContentScriptMessageType = 
  | 'SITE_BLOCKED'
  | 'REDIRECT_STARTED'
  | 'REDIRECT_CANCELLED'
  | 'DEBUG_LOG';

export interface ContentScriptMessage {
  type: ContentScriptMessageType;
  data?: any;
}