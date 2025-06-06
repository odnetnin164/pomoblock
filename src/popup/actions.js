/**
 * Popup actions for blocking and whitelisting sites
 */

import { 
  addBlockedWebsite, 
  addWhitelistedPath, 
  removeWhitelistedPath,
  getWhitelistedPaths 
} from '../shared/utils/storage.js';
import { SiteAnalyzer } from './site-analyzer.js';

export class PopupActions {
  constructor() {
    this.siteAnalyzer = new SiteAnalyzer();
  }

  /**
   * Block a site
   * @param {string} targetToBlock - The target to block
   * @param {HTMLElement} button - The button element to update
   */
  async blockSite(targetToBlock, button) {
    if (!targetToBlock) return;
    
    button.disabled = true;
    button.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Adding...</span>
    `;

    try {
      await addBlockedWebsite(targetToBlock);
      
      // Success animation
      button.classList.add('success');
      button.innerHTML = `
        <span class="btn-icon">✓</span>
        <span class="btn-text">Blocked!</span>
      `;
      
      setTimeout(() => {
        button.classList.remove('success');
        button.classList.add('already-blocked');
        button.innerHTML = `
          <span class="btn-icon">✓</span>
          <span class="btn-text">Already Blocked</span>
        `;
      }, 1500);
    } catch (error) {
      console.error('Error blocking site:', error);
      button.innerHTML = `
        <span class="btn-icon">❌</span>
        <span class="btn-text">Error</span>
      `;
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = `
          <span class="btn-icon">🚫</span>
          <span class="btn-text">Block This Page</span>
        `;
      }, 2000);
    }
  }

  /**
   * Whitelist a path
   * @param {string} targetToWhitelist - The path to whitelist
   * @param {HTMLElement} button - The button element to update
   */
  async whitelistPath(targetToWhitelist, button) {
    if (!targetToWhitelist) return;
    
    button.disabled = true;
    button.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Adding...</span>
    `;

    try {
      await addWhitelistedPath(targetToWhitelist);
      
      // Success animation
      button.classList.add('success');
      button.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Whitelisted!</span>
      `;
      
      setTimeout(() => {
        button.innerHTML = `
          <span class="btn-icon">✅</span>
          <span class="btn-text">Already Whitelisted</span>
        `;
      }, 1500);
    } catch (error) {
      console.error('Error whitelisting path:', error);
      button.innerHTML = `
        <span class="btn-icon">❌</span>
        <span class="btn-text">Error</span>
      `;
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = `
          <span class="btn-icon">✅</span>
          <span class="btn-text">Whitelist This Path</span>
        `;
      }, 2000);
    }
  }

  /**
   * Show whitelist option for pages that would be blocked
   * @param {string} targetToWhitelist - The target to whitelist
   * @param {Function} onSuccess - Callback for successful whitelist
   */
  showWhitelistOption(targetToWhitelist, onSuccess) {
    const whitelistOption = document.createElement('div');
    whitelistOption.className = 'whitelist-option';
    whitelistOption.innerHTML = `
      <button class="whitelist-btn" id="whitelistCurrentButton">
        <span class="btn-icon">✅</span>
        <span class="btn-text">Whitelist This Path</span>
      </button>
      <small style="display: block; margin-top: 5px; color: rgba(255,255,255,0.8);">
        Add exception for this specific page
      </small>
    `;
    
    document.querySelector('.main-action').appendChild(whitelistOption);
    
    // Add event listener
    document.getElementById('whitelistCurrentButton').addEventListener('click', async () => {
      await this.whitelistPath(targetToWhitelist, document.getElementById('whitelistCurrentButton'));
      if (onSuccess) onSuccess();
    });
  }

  /**
   * Show whitelist info and remove button for whitelisted pages
   * @param {string} currentUrl - Current page URL
   * @param {Function} onRemove - Callback for successful removal
   */
  async showWhitelistInfo(currentUrl, onRemove) {
    try {
      const whitelistedPaths = await getWhitelistedPaths();
      const matchingEntry = this.siteAnalyzer.findMatchingWhitelistEntry(currentUrl, whitelistedPaths);
      
      if (matchingEntry) {
        const whitelistInfo = document.createElement('div');
        whitelistInfo.className = 'whitelist-notice';
        whitelistInfo.innerHTML = `
          <small style="color: #4CAF50; margin-bottom: 15px; display: block;">
            This page is whitelisted and won't be blocked
          </small>
          <button class="remove-whitelist-btn" id="removeWhitelistButton">
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">Remove from Whitelist</span>
          </button>
        `;
        document.querySelector('.site-info').appendChild(whitelistInfo);
        
        // Add event listener for remove button
        document.getElementById('removeWhitelistButton').addEventListener('click', async () => {
          await this.removeFromWhitelist(matchingEntry, document.getElementById('removeWhitelistButton'));
          if (onRemove) onRemove();
        });
      }
    } catch (error) {
      console.error('Error showing whitelist info:', error);
    }
  }

  /**
   * Remove a path from whitelist
   * @param {string} pathToRemove - The path to remove
   * @param {HTMLElement} button - The button element to update
   */
  async removeFromWhitelist(pathToRemove, button) {
    button.disabled = true;
    button.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Removing...</span>
    `;

    try {
      await removeWhitelistedPath(pathToRemove);
      
      // Success animation
      button.classList.add('success');
      button.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Removed!</span>
      `;
      
      setTimeout(() => {
        // Remove the whitelist notice and show normal block button
        const whitelistNotice = document.querySelector('.whitelist-notice');
        if (whitelistNotice) {
          whitelistNotice.remove();
        }
        
        // Reset main block button
        const blockCurrentButton = document.getElementById('blockCurrentButton');
        if (blockCurrentButton) {
          blockCurrentButton.classList.remove('already-blocked');
          blockCurrentButton.innerHTML = `
            <span class="btn-icon">🚫</span>
            <span class="btn-text">Block This Page</span>
          `;
          blockCurrentButton.disabled = false;
        }
      }, 1500);
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      button.innerHTML = `
        <span class="btn-icon">❌</span>
        <span class="btn-text">Error</span>
      `;
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = `
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">Remove from Whitelist</span>
        `;
      }, 2000);
    }
  }
}