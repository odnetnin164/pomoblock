import { BlockTarget, WhitelistTarget, BlockOption, BlockType } from '@shared/types';
import { determineBlockTarget, getTargetLabel, parseSiteInfo, generateBlockOptions, generateSubdomainWhitelistOptions } from '@shared/urlUtils';
import { addBlockedWebsite, addWhitelistedPath, removeWhitelistedPath } from '@shared/storage';
import { SPECIAL_SITES } from '@shared/constants';
import { BlockingEngine } from '@contentScript/blockingEngine';
import { logger } from '@shared/logger';

export class SiteManager {
  private currentTabUrl: string = '';
  private blockTarget: BlockTarget | null = null;
  private blockOptions: BlockOption[] = [];
  private selectedBlockType: BlockType = 'domain';
  private selectedBlockIndex: number = 0;
  private blockingEngine: BlockingEngine;

  constructor() {
    this.blockingEngine = new BlockingEngine();
  }

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
    // Update the selected index to match the new type
    const optionIndex = this.blockOptions.findIndex(opt => opt.type === blockType);
    if (optionIndex !== -1) {
      this.selectedBlockIndex = optionIndex;
    }
  }

  /**
   * Set selected block option by index
   */
  setSelectedBlockIndex(index: number): void {
    if (index >= 0 && index < this.blockOptions.length) {
      this.selectedBlockIndex = index;
      this.selectedBlockType = this.blockOptions[index].type;
    }
  }

  /**
   * Get the target string for the currently selected block option
   */
  getSelectedBlockTarget(): string {
    const option = this.blockOptions[this.selectedBlockIndex];
    return option ? option.target : this.blockTarget?.target || '';
  }

  /**
   * Get the currently selected block option
   */
  getSelectedBlockOption(): BlockOption | null {
    return this.blockOptions[this.selectedBlockIndex] || null;
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
    this.selectedBlockIndex = 0;
    
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
    return this.blockingEngine.findMatchingWhitelistEntry(whitelistedPaths, this.currentTabUrl);
  }

  /**
   * Check if current page would be blocked by existing rules
   */
  checkIfWouldBeBlocked(blockedWebsites: string[]): boolean {
    return this.blockingEngine.checkIfUrlWouldBeBlocked(blockedWebsites, this.currentTabUrl);
  }

  /**
   * Check if a specific target would be blocked by existing rules
   */
  checkIfTargetWouldBeBlocked(target: string, blockedWebsites: string[]): boolean {
    // Convert the target to a URL format for testing
    let testUrl: string;
    if (target.includes('/')) {
      // Target is a path (e.g., "github.com/user/repo")
      testUrl = `https://${target}`;
    } else {
      // Target is a domain (e.g., "github.com")
      testUrl = `https://${target}/`;
    }
    
    logger.log('checkIfTargetWouldBeBlocked:', {
      target,
      testUrl,
      blockedWebsites
    });
    
    const result = this.blockingEngine.checkIfUrlWouldBeBlocked(blockedWebsites, testUrl);
    logger.log('checkIfTargetWouldBeBlocked result:', result);
    
    return result;
  }

  /**
   * Check if current page is whitelisted
   */
  checkIfWhitelisted(whitelistedPaths: string[]): boolean {
    return this.blockingEngine.checkIfUrlIsWhitelisted(whitelistedPaths, this.currentTabUrl);
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

  /**
   * Initialize blocking engine with current state
   */
  initializeBlockingEngine(blockedWebsites: string[], whitelistedPaths: string[], blockedToggleState: any, whitelistToggleState: any): void {
    this.blockingEngine.updateBlockedSites(blockedWebsites);
    this.blockingEngine.updateWhitelistedPaths(whitelistedPaths);
    this.blockingEngine.updateBlockedSitesToggleState(blockedToggleState);
    this.blockingEngine.updateWhitelistedPathsToggleState(whitelistToggleState);
  }

  /**
   * Check if a site is enabled in the blocklist
   */
  isSiteEnabled(site: string): boolean {
    return this.blockingEngine.isBlockedSiteEnabled(site);
  }

  /**
   * Check if a path is enabled in the whitelist
   */
  isPathEnabled(path: string): boolean {
    return this.blockingEngine.isWhitelistedPathEnabled(path);
  }
}