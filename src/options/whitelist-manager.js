/**
 * Whitelist management for options page
 */

import { 
  getWhitelistedPaths, 
  saveWhitelistedPaths, 
  addWhitelistedPath, 
  removeWhitelistedPath 
} from '../shared/utils/storage.js';
import { cleanURL, isValidDomain } from '../shared/utils/url-utils.js';
import { getPathType } from '../shared/utils/site-detection.js';

export class WhitelistManager {
  constructor() {
    this.optionsMain = null;
  }

  init(optionsMain) {
    this.optionsMain = optionsMain;
  }

  /**
   * Load and display whitelisted paths
   */
  async loadWhitelistedPaths() {
    try {
      const whitelistedPaths = await getWhitelistedPaths();
      this.displayWhitelistedPaths(whitelistedPaths);
      this.updateWhitelistCount(whitelistedPaths.length);
    } catch (error) {
      console.error('Error loading whitelisted paths:', error);
      this.optionsMain.uiManager.showStatusMessage('Error loading whitelisted paths', 'error');
    }
  }

  /**
   * Display the list of whitelisted paths
   * @param {Array} paths - Array of whitelisted paths
   */
  displayWhitelistedPaths(paths) {
    if (paths.length === 0) {
      this.optionsMain.whitelistedPathsList.innerHTML = `
        <div class="empty-state">
          <p>No paths whitelisted yet</p>
          <small>Add a whitelisted path above to get started</small>
        </div>
      `;
      this.optionsMain.clearAllWhitelist.disabled = true;
      return;
    }

    this.optionsMain.clearAllWhitelist.disabled = false;

    const pathsHTML = paths.map((path, index) => {
      const pathType = getPathType(path);
      return `
        <div class="site-item" data-index="${index}">
          <div style="display: flex; align-items: center; flex: 1;">
            <span class="site-url">${path}</span>
            ${pathType ? `<span class="site-type whitelist-type">${pathType}</span>` : ''}
          </div>
          <button class="remove-site-btn" data-path="${path}">Remove</button>
        </div>
      `;
    }).join('');

    this.optionsMain.whitelistedPathsList.innerHTML = pathsHTML;

    // Add remove button listeners
    this.optionsMain.whitelistedPathsList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', () => {
        const pathToDelete = button.getAttribute('data-path');
        this.removeWhitelistPath(pathToDelete);
      });
    });
  }

  /**
   * Add a new path to the whitelist
   */
  async addNewWhitelistPath() {
    const path = this.optionsMain.newWhitelistInput.value.trim().toLowerCase();
    
    if (!path) {
      this.optionsMain.uiManager.showStatusMessage('Please enter a path to whitelist', 'error');
      this.optionsMain.newWhitelistInput.focus();
      return;
    }

    // Basic path validation and cleaning
    const cleanedPath = cleanURL(path);
    
    if (!this.isValidPath(cleanedPath)) {
      this.optionsMain.uiManager.showStatusMessage('Please enter a valid domain/path combination', 'error');
      this.optionsMain.newWhitelistInput.focus();
      return;
    }

    try {
      const whitelistedPaths = await getWhitelistedPaths();
      
      if (whitelistedPaths.includes(cleanedPath)) {
        this.optionsMain.uiManager.showStatusMessage('Path is already whitelisted', 'error');
        return;
      }

      await addWhitelistedPath(cleanedPath);
      this.optionsMain.newWhitelistInput.value = '';
      await this.loadWhitelistedPaths();
      this.optionsMain.uiManager.showStatusMessage('Path whitelisted successfully!', 'success');
    } catch (error) {
      console.error('Error adding whitelist path:', error);
      this.optionsMain.uiManager.showStatusMessage('Error adding whitelisted path', 'error');
    }
  }

  /**
   * Remove a path from the whitelist
   * @param {string} pathToDelete - Path to remove
   */
  async removeWhitelistPath(pathToDelete) {
    try {
      await removeWhitelistedPath(pathToDelete);
      await this.loadWhitelistedPaths();
      this.optionsMain.uiManager.showStatusMessage('Whitelisted path removed successfully!', 'success');
    } catch (error) {
      console.error('Error removing whitelist path:', error);
      this.optionsMain.uiManager.showStatusMessage('Error removing whitelisted path', 'error');
    }
  }

  /**
   * Clear all whitelisted paths
   */
  async clearAllWhitelistedPaths() {
    if (confirm('Are you sure you want to remove all whitelisted paths? This cannot be undone.')) {
      try {
        await saveWhitelistedPaths([]);
        await this.loadWhitelistedPaths();
        this.optionsMain.uiManager.showStatusMessage('All whitelisted paths cleared!', 'success');
      } catch (error) {
        console.error('Error clearing whitelist paths:', error);
        this.optionsMain.uiManager.showStatusMessage('Error clearing whitelisted paths', 'error');
      }
    }
  }

  /**
   * Update whitelist count display
   * @param {number} count - Number of paths
   */
  updateWhitelistCount(count) {
    this.optionsMain.whitelistCount.textContent = `${count} path${count !== 1 ? 's' : ''} whitelisted`;
  }

  /**
   * Validate path for whitelist (should include domain and optionally path)
   * @param {string} input - Path to validate
   * @returns {boolean} True if valid
   */
  isValidPath(input) {
    // For whitelist, we allow both domain-only and domain/path combinations
    return isValidDomain(input);
  }
}