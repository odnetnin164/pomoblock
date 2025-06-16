import { StatusMessage, SiteType, SiteToggleState } from '@shared/types';
import { 
  getBlockedWebsites, 
  getWhitelistedPaths, 
  addBlockedWebsite, 
  removeBlockedWebsite,
  addWhitelistedPath,
  removeWhitelistedPath,
  clearAllBlockedWebsites,
  clearAllWhitelistedPaths,
  getBlockedSitesToggleState,
  getWhitelistedPathsToggleState,
  toggleBlockedSite,
  toggleWhitelistedPath,
  isBlockedSiteEnabled,
  isWhitelistedPathEnabled
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
   * Edit a website in blocked list
   */
  async editBlockedSite(oldWebsite: string, newWebsite: string): Promise<boolean> {
    if (!newWebsite.trim()) {
      this.showStatusMessage({
        text: 'Please enter a website URL',
        type: 'error'
      });
      return false;
    }

    const cleanedWebsite = cleanURL(newWebsite);
    
    if (!isValidDomain(cleanedWebsite)) {
      this.showStatusMessage({
        text: 'Please enter a valid domain or URL',
        type: 'error'
      });
      return false;
    }

    try {
      const currentSites = await getBlockedWebsites();
      
      if (cleanedWebsite !== oldWebsite && currentSites.includes(cleanedWebsite)) {
        this.showStatusMessage({
          text: 'Website is already blocked',
          type: 'error'
        });
        return false;
      }

      // Remove old and add new
      await removeBlockedWebsite(oldWebsite);
      await addBlockedWebsite(cleanedWebsite);
      
      this.showStatusMessage({
        text: 'Website updated successfully!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error updating website: ${(error as Error).message}`,
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
   * Edit a path in whitelist
   */
  async editWhitelistedPath(oldPath: string, newPath: string): Promise<boolean> {
    if (!newPath.trim()) {
      this.showStatusMessage({
        text: 'Please enter a path to whitelist',
        type: 'error'
      });
      return false;
    }

    const cleanedPath = cleanURL(newPath);
    
    if (!isValidPath(cleanedPath)) {
      this.showStatusMessage({
        text: 'Please enter a valid domain/path combination',
        type: 'error'
      });
      return false;
    }

    try {
      const currentPaths = await getWhitelistedPaths();
      
      if (cleanedPath !== oldPath && currentPaths.includes(cleanedPath)) {
        this.showStatusMessage({
          text: 'Path is already whitelisted',
          type: 'error'
        });
        return false;
      }

      // Remove old and add new
      await removeWhitelistedPath(oldPath);
      await addWhitelistedPath(cleanedPath);
      
      this.showStatusMessage({
        text: 'Whitelisted path updated successfully!',
        type: 'success'
      });
      this.notifySitesUpdated();
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error updating path: ${(error as Error).message}`,
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
   * Get blocked sites toggle state
   */
  async getBlockedSitesToggleState(): Promise<SiteToggleState> {
    try {
      return await getBlockedSitesToggleState();
    } catch (error) {
      this.showStatusMessage({
        text: `Error loading blocked sites toggle state: ${(error as Error).message}`,
        type: 'error'
      });
      return {};
    }
  }

  /**
   * Get whitelisted paths toggle state
   */
  async getWhitelistedPathsToggleState(): Promise<SiteToggleState> {
    try {
      return await getWhitelistedPathsToggleState();
    } catch (error) {
      this.showStatusMessage({
        text: `Error loading whitelisted paths toggle state: ${(error as Error).message}`,
        type: 'error'
      });
      return {};
    }
  }

  /**
   * Toggle blocked site enabled/disabled
   */
  async toggleBlockedSiteEnabled(website: string): Promise<boolean> {
    try {
      const newState = await toggleBlockedSite(website);
      this.showStatusMessage({
        text: `${website} ${newState ? 'enabled' : 'disabled'}`,
        type: 'success'
      });
      this.notifySitesUpdated();
      return newState;
    } catch (error) {
      this.showStatusMessage({
        text: `Error toggling website: ${(error as Error).message}`,
        type: 'error'
      });
      return true; // Return default state on error
    }
  }

  /**
   * Toggle whitelisted path enabled/disabled
   */
  async toggleWhitelistedPathEnabled(path: string): Promise<boolean> {
    try {
      const newState = await toggleWhitelistedPath(path);
      this.showStatusMessage({
        text: `${path} ${newState ? 'enabled' : 'disabled'}`,
        type: 'success'
      });
      this.notifySitesUpdated();
      return newState;
    } catch (error) {
      this.showStatusMessage({
        text: `Error toggling path: ${(error as Error).message}`,
        type: 'error'
      });
      return true; // Return default state on error
    }
  }

  /**
   * Check if blocked site is enabled
   */
  async isBlockedSiteEnabled(website: string): Promise<boolean> {
    try {
      return await isBlockedSiteEnabled(website);
    } catch (error) {
      console.error('Error checking if blocked site is enabled:', error);
      return true; // Default to enabled
    }
  }

  /**
   * Check if whitelisted path is enabled
   */
  async isWhitelistedPathEnabled(path: string): Promise<boolean> {
    try {
      return await isWhitelistedPathEnabled(path);
    } catch (error) {
      console.error('Error checking if whitelisted path is enabled:', error);
      return true; // Default to enabled
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