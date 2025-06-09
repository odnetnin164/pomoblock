// Extension Settings Types
export interface WorkHours {
  enabled: boolean;
  startTime: string; // "09:00" format (24-hour)
  endTime: string; // "17:00" format (24-hour)
  days: number[]; // [1,2,3,4,5] for Mon-Fri, 0=Sunday, 6=Saturday
}

export interface ExtensionSettings {
  blockMode: 'block' | 'redirect';
  redirectUrl: string;
  redirectDelay: number;
  extensionEnabled: boolean;
  debugEnabled: boolean;
  workHours: WorkHours;
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
  workHoursEnabled?: boolean;
  workHoursStartTime?: string;
  workHoursEndTime?: string;
  workHoursDays?: number[];
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