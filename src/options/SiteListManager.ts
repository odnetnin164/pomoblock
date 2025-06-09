import { StatusMessage, SiteType } from '@shared/types';
import { 
  getBlockedWebsites, 
  getWhitelistedPaths, 
  addBlockedWebsite, 
  removeBlockedWebsite,
  addWhitelistedPath,
  removeWhitelistedPath,
  clearAllBlockedWebsites,
  clearAllWhitelistedPaths
} from '@shared/storage';
import { cleanURL, isValidDomain, isValidPath, getSiteType } from '@shared/urlUtils';

export class SiteListManager {
  private onStatusMessage: ((message: StatusMessage) => void) | undefined;
  private onSitesUpdated: (() => void) | undefined;

  constructor(
    onStatusMessage?: (message: StatusMessage) => void,
    onSitesUpdated?: () => void
  ) {
    this.onStatusMessage = onStatusMessage;
    this.onSitesUpdated = onSitesUpdated;
  }

  /**
   * Load blocked websites from storage
   */
  async loadBlockedWebsites(): Promise<string[]> {
    try {
      return await getBlockedWebsites();
    } catch (error) {
      this.showStatusMessage({
        text: `Error loading blocked websites: ${(error as Error).message}`,
        type: 'error'
      });
      return [];
    }
  }

  /**
   * Load whitelisted paths from storage
   */
  async loadWhitelistedPaths(): Promise<string[]> {
    try {
      return await getWhitelistedPaths();
    } catch (error) {
      this.showStatusMessage({
        text: `Error loading whitelisted paths: ${(error as Error).message}`,
        type: 'error'
      });
      return [];
    }
  }

  /**
   * Add a new website to blocked list
   */
  async addBlockedSite(website: string): Promise<boolean> {
    if (!website.trim()) {
      this.showStatusMessage({
        text: 'Please enter a website URL',
        type: 'error'
      });
      return false;
    }

    const cleanedWebsite = cleanURL(website);
    
    if (!isValidDomain(cleanedWebsite)) {
      this.showStatusMessage({
        text: 'Please enter a valid domain or URL',
        type: 'error'
      });
      return false;
    }

    try {
      const currentSites = await getBlockedWebsites();
      
      if (currentSites.includes(cleanedWebsite)) {
        this.showStatusMessage({
          text: 'Website is already blocked',
          type: 'error'
        });
        return false;
      }

      await addBlockedWebsite(cleanedWebsite);
      this.showStatusMessage({
        text: 'Website added successfully!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error adding website: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Add a new path to whitelist
   */
  async addWhitelistedPath(path: string): Promise<boolean> {
    if (!path.trim()) {
      this.showStatusMessage({
        text: 'Please enter a path to whitelist',
        type: 'error'
      });
      return false;
    }

    const cleanedPath = cleanURL(path);
    
    if (!isValidPath(cleanedPath)) {
      this.showStatusMessage({
        text: 'Please enter a valid domain/path combination',
        type: 'error'
      });
      return false;
    }

    try {
      const currentPaths = await getWhitelistedPaths();
      
      if (currentPaths.includes(cleanedPath)) {
        this.showStatusMessage({
          text: 'Path is already whitelisted',
          type: 'error'
        });
        return false;
      }

      await addWhitelistedPath(cleanedPath);
      this.showStatusMessage({
        text: 'Path whitelisted successfully!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error whitelisting path: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Remove a website from blocked list
   */
  async removeBlockedSite(website: string): Promise<boolean> {
    try {
      await removeBlockedWebsite(website);
      this.showStatusMessage({
        text: 'Website removed successfully!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error removing website: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Remove a path from whitelist
   */
  async removeWhitelistedPath(path: string): Promise<boolean> {
    try {
      await removeWhitelistedPath(path);
      this.showStatusMessage({
        text: 'Whitelisted path removed successfully!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error removing path: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Clear all blocked websites
   */
  async clearAllBlockedSites(): Promise<boolean> {
    if (!confirm('Are you sure you want to remove all blocked websites? This cannot be undone.')) {
      return false;
    }

    try {
      await clearAllBlockedWebsites();
      this.showStatusMessage({
        text: 'All websites cleared!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error clearing websites: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Clear all whitelisted paths
   */
  async clearAllWhitelistedPaths(): Promise<boolean> {
    if (!confirm('Are you sure you want to remove all whitelisted paths? This cannot be undone.')) {
      return false;
    }

    try {
      await clearAllWhitelistedPaths();
      this.showStatusMessage({
        text: 'All whitelisted paths cleared!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error clearing paths: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Get site type for display
   */
  getSiteType(site: string): SiteType | null {
    return getSiteType(site);
  }

  /**
   * Get user-friendly label for site type
   */
  getSiteTypeLabel(site: string): string {
    const type = this.getSiteType(site);
    if (!type) return '';
    
    switch (type) {
      case 'Subreddit': return 'Subreddit';
      case 'Channel': return 'Channel';
      case 'Profile': return 'Profile';
      case 'Subdomain': return 'Subdomain';
      case 'Path': return 'Path';
      case 'Domain': return 'Domain';
      default: return '';
    }
  }

  /**
   * Validate input and show immediate feedback
   */
  validateInput(input: string, isWhitelist: boolean = false): { isValid: boolean; message?: string } {
    if (!input.trim()) {
      return { isValid: false, message: 'Please enter a URL' };
    }

    const cleaned = cleanURL(input);
    const isValid = isWhitelist ? isValidPath(cleaned) : isValidDomain(cleaned);
    
    if (!isValid) {
      return { 
        isValid: false, 
        message: isWhitelist ? 'Invalid domain/path format' : 'Invalid domain format'
      };
    }

    return { isValid: true };
  }

  /**
   * Show status message
   */
  private showStatusMessage(message: StatusMessage): void {
    if (this.onStatusMessage) {
      this.onStatusMessage(message);
    }
  }

  /**
   * Notify that sites were updated
   */
  private notifySitesUpdated(): void {
    if (this.onSitesUpdated) {
      this.onSitesUpdated();
    }
  }
}