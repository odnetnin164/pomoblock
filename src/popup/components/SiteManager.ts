import { BlockTarget, WhitelistTarget, BlockOption, BlockType } from '@shared/types';
import { determineBlockTarget, getTargetLabel, parseSiteInfo, generateBlockOptions, generateSubdomainWhitelistOptions } from '@shared/urlUtils';
import { addBlockedWebsite, addWhitelistedPath, removeWhitelistedPath } from '@shared/storage';
import { SPECIAL_SITES } from '@shared/constants';

export class SiteManager {
  private currentTabUrl: string = '';
  private blockTarget: BlockTarget | null = null;
  private blockOptions: BlockOption[] = [];
  private selectedBlockType: BlockType = 'domain';

  /**
   * Set current tab URL and analyze it
   */
  setCurrentTab(url: string): void {
    this.currentTabUrl = url;
    this.analyzeCurrentSite();
  }

  /**
   * Get current site information for display
   */
  getCurrentSiteInfo(): { url: string; hostname: string; pathname: string } | null {
    if (!this.currentTabUrl) return null;

    try {
      const urlObj = new URL(this.currentTabUrl);
      return {
        url: this.currentTabUrl,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname
      };
    } catch {
      return null;
    }
  }

  /**
   * Get current block target information
   */
  getBlockTarget(): BlockTarget | null {
    return this.blockTarget;
  }

  /**
   * Get available block options for current site
   */
  getBlockOptions(): BlockOption[] {
    return this.blockOptions;
  }

  /**
   * Get currently selected block type
   */
  getSelectedBlockType(): BlockType {
    return this.selectedBlockType;
  }

  /**
   * Set selected block type
   */
  setSelectedBlockType(blockType: BlockType): void {
    this.selectedBlockType = blockType;
  }

  /**
   * Get the target string for the currently selected block type
   */
  getSelectedBlockTarget(): string {
    const option = this.blockOptions.find(opt => opt.type === this.selectedBlockType);
    return option ? option.target : this.blockTarget?.target || '';
  }

  /**
   * Analyze current site and determine block target
   */
  private analyzeCurrentSite(): void {
    const siteInfo = this.getCurrentSiteInfo();
    if (!siteInfo) {
      this.blockTarget = null;
      this.blockOptions = [];
      return;
    }

    // Generate all available block options
    this.blockOptions = generateBlockOptions(this.currentTabUrl);
    
    // Set default selection to domain block
    this.selectedBlockType = 'domain';
    
    // Keep legacy block target for backward compatibility
    const target = determineBlockTarget(siteInfo.hostname, siteInfo.pathname);
    if (!target) {
      this.blockTarget = null;
      return;
    }

    const label = getTargetLabel(target);
    const isSpecialSite = this.isSpecialSite(siteInfo.hostname);

    this.blockTarget = {
      target,
      label,
      isSpecialSite,
      isWhitelisted: false, // Will be updated by popup
      isBlocked: false      // Will be updated by popup
    };
  }

  /**
   * Check if hostname is a special site
   */
  private isSpecialSite(hostname: string): boolean {
    return SPECIAL_SITES.some(site => hostname.includes(site));
  }

  /**
   * Add current site to blocked list using selected block type
   */
  async addToBlockedList(): Promise<string[]> {
    const target = this.getSelectedBlockTarget();
    if (!target) {
      throw new Error('No target to block');
    }

    return await addBlockedWebsite(target);
  }

  /**
   * Add current path to whitelist
   */
  async addToWhitelist(): Promise<string[]> {
    const target = this.getSelectedBlockTarget();
    if (!target) {
      throw new Error('No target to whitelist');
    }

    return await addWhitelistedPath(target);
  }

  /**
   * Get subdomain whitelist options for current site
   */
  getSubdomainWhitelistOptions(blockedDomains: string[]): BlockOption[] {
    if (!this.currentTabUrl) return [];
    return generateSubdomainWhitelistOptions(this.currentTabUrl, blockedDomains);
  }

  /**
   * Remove current path from whitelist
   */
  async removeFromWhitelist(whitelistedPaths: string[]): Promise<string[]> {
    const matchingEntry = this.findMatchingWhitelistEntry(whitelistedPaths);
    if (!matchingEntry) {
      throw new Error('No matching whitelist entry found');
    }

    return await removeWhitelistedPath(matchingEntry);
  }

  /**
   * Find matching whitelist entry for current page
   */
  findMatchingWhitelistEntry(whitelistedPaths: string[]): string | null {
    const siteInfo = this.getCurrentSiteInfo();
    if (!siteInfo) return null;

    const currentHostname = siteInfo.hostname.replace(/^www\./, '').toLowerCase();
    const currentPathname = siteInfo.pathname.toLowerCase();
    
    for (const whitelistedPath of whitelistedPaths) {
      const pathLower = whitelistedPath.toLowerCase();
      
      if (pathLower.includes('/')) {
        // Path-specific whitelist
        const [pathDomain, ...pathParts] = pathLower.split('/');
        const pathPath = '/' + pathParts.join('/');
        
        if (currentHostname === pathDomain && currentPathname.startsWith(pathPath)) {
          return whitelistedPath; // Return original case version
        }
      } else {
        // Domain-only whitelist
        if (currentHostname === pathLower || currentHostname.endsWith('.' + pathLower)) {
          return whitelistedPath; // Return original case version
        }
      }
    }
    
    return null;
  }

  /**
   * Check if current page would be blocked by existing rules
   */
  checkIfWouldBeBlocked(blockedWebsites: string[]): boolean {
    const siteInfo = this.getCurrentSiteInfo();
    if (!siteInfo) return false;

    const currentHostname = siteInfo.hostname.replace(/^www\./, '').toLowerCase();
    
    for (const site of blockedWebsites) {
      const siteLower = site.toLowerCase();
      
      if (siteLower.includes('/')) {
        // Path-based block - skip for now
        continue;
      } else {
        // Domain-based block - check if current page would be blocked
        if (currentHostname === siteLower || currentHostname.endsWith('.' + siteLower)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if current page is whitelisted
   */
  checkIfWhitelisted(whitelistedPaths: string[]): boolean {
    return this.findMatchingWhitelistEntry(whitelistedPaths) !== null;
  }

  /**
   * Update block target status
   */
  updateBlockTargetStatus(isBlocked: boolean, isWhitelisted: boolean): void {
    if (this.blockTarget) {
      this.blockTarget.isBlocked = isBlocked;
      this.blockTarget.isWhitelisted = isWhitelisted;
    }
  }
}