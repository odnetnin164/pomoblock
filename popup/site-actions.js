// Site actions for popup (blocking/whitelisting)
import { addBlockedWebsite, addWhitelistedPath, removeWhitelistedPath } from '../utils/storage-utils.js';

export class SiteActions {
  constructor(tabAnalyzer) {
    this.tabAnalyzer = tabAnalyzer;
  }

  /**
   * Block the current site
   */
  async blockCurrentSite() {
    const { targetToBlock, isAlreadyBlocked } = this.tabAnalyzer.getState();
    
    if (!targetToBlock || isAlreadyBlocked) {
      throw new Error('Site cannot be blocked or is already blocked');
    }
    
    try {
      await addBlockedWebsite(targetToBlock);
      
      // Update analyzer state
      this.tabAnalyzer.isAlreadyBlocked = true;
      
      return {
        success: true,
        message: 'Website blocked successfully!',
        target: targetToBlock
      };
    } catch (error) {
      throw new Error('Failed to block website: ' + error.message);
    }
  }

  /**
   * Whitelist the current path
   */
  async whitelistCurrentPath() {
    const { targetToBlock } = this.tabAnalyzer.getState();
    
    if (!targetToBlock) {
      throw new Error('No target to whitelist');
    }
    
    try {
      await addWhitelistedPath(targetToBlock);
      
      // Update analyzer state
      this.tabAnalyzer.isWhitelisted = true;
      
      return {
        success: true,
        message: 'Path whitelisted successfully!',
        target: targetToBlock
      };
    } catch (error) {
      throw new Error('Failed to whitelist path: ' + error.message);
    }
  }

  /**
   * Remove current page from whitelist
   */
  async removeFromWhitelist() {
    try {
      // Find the exact whitelist entry that matches the current page
      const matchingEntry = await this.tabAnalyzer.findMatchingWhitelistEntry();
      
      if (!matchingEntry) {
        throw new Error('No matching whitelist entry found');
      }
      
      await removeWhitelistedPath(matchingEntry);
      
      // Update analyzer state
      this.tabAnalyzer.isWhitelisted = false;
      
      return {
        success: true,
        message: 'Removed from whitelist successfully!',
        target: matchingEntry
      };
    } catch (error) {
      throw new Error('Failed to remove from whitelist: ' + error.message);
    }
  }

  /**
   * Check if whitelist option should be shown
   */
  async shouldShowWhitelistOption() {
    const { targetToBlock } = this.tabAnalyzer.getState();
    
    if (!targetToBlock || !targetToBlock.includes('/')) {
      return false;
    }
    
    try {
      return await this.tabAnalyzer.wouldBeBlockedByExistingRule();
    } catch (error) {
      console.error('Error checking whitelist option:', error);
      return false;
    }
  }
}