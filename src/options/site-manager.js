/**
 * Site management for options page
 */

import { 
  getBlockedWebsites, 
  saveBlockedWebsites, 
  addBlockedWebsite, 
  removeBlockedWebsite 
} from '../shared/utils/storage.js';
import { cleanURL, isValidDomain } from '../shared/utils/url-utils.js';
import { getSiteType } from '../shared/utils/site-detection.js';

export class SiteManager {
  constructor() {
    this.optionsMain = null;
  }

  init(optionsMain) {
    this.optionsMain = optionsMain;
  }

  /**
   * Load and display blocked sites
   */
  async loadBlockedSites() {
    try {
      const blockedWebsites = await getBlockedWebsites();
      this.displayBlockedSites(blockedWebsites);
      this.updateSitesCount(blockedWebsites.length);
    } catch (error) {
      console.error('Error loading blocked sites:', error);
      this.optionsMain.uiManager.showStatusMessage('Error loading blocked sites', 'error');
    }
  }

  /**
   * Display the list of blocked sites
   * @param {Array} sites - Array of blocked sites
   */
  displayBlockedSites(sites) {
    if (sites.length === 0) {
      this.optionsMain.blockedSitesList.innerHTML = `
        <div class="empty-state">
          <p>No sites blocked yet</p>
          <small>Add a website above to get started</small>
        </div>
      `;
      this.optionsMain.clearAllSites.disabled = true;
      return;
    }

    this.optionsMain.clearAllSites.disabled = false;

    const sitesHTML = sites.map((site, index) => {
      const siteType = getSiteType(site);
      return `
        <div class="site-item" data-index="${index}">
          <div style="display: flex; align-items: center; flex: 1;">
            <span class="site-url">${site}</span>
            ${siteType ? `<span class="site-type">${siteType}</span>` : ''}
          </div>
          <button class="remove-site-btn" data-site="${site}">Remove</button>
        </div>
      `;
    }).join('');

    this.optionsMain.blockedSitesList.innerHTML = sitesHTML;

    // Add remove button listeners
    this.optionsMain.blockedSitesList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', () => {
        const siteToDelete = button.getAttribute('data-site');
        this.removeSite(siteToDelete);
      });
    });
  }

  /**
   * Add a new site to the blocked list
   */
  async addNewSite() {
    const website = this.optionsMain.newSiteInput.value.trim().toLowerCase();
    
    if (!website) {
      this.optionsMain.uiManager.showStatusMessage('Please enter a website URL', 'error');
      this.optionsMain.newSiteInput.focus();
      return;
    }

    // Basic URL validation and cleaning
    const cleanedWebsite = cleanURL(website);
    
    if (!isValidDomain(cleanedWebsite)) {
      this.optionsMain.uiManager.showStatusMessage('Please enter a valid domain or URL', 'error');
      this.optionsMain.newSiteInput.focus();
      return;
    }

    try {
      const blockedWebsites = await getBlockedWebsites();
      
      if (blockedWebsites.includes(cleanedWebsite)) {
        this.optionsMain.uiManager.showStatusMessage('Website is already blocked', 'error');
        return;
      }

      await addBlockedWebsite(cleanedWebsite);
      this.optionsMain.newSiteInput.value = '';
      await this.loadBlockedSites();
      this.optionsMain.uiManager.showStatusMessage('Website added successfully!', 'success');
    } catch (error) {
      console.error('Error adding site:', error);
      this.optionsMain.uiManager.showStatusMessage('Error adding website', 'error');
    }
  }

  /**
   * Remove a site from the blocked list
   * @param {string} siteToDelete - Site to remove
   */
  async removeSite(siteToDelete) {
    try {
      await removeBlockedWebsite(siteToDelete);
      await this.loadBlockedSites();
      this.optionsMain.uiManager.showStatusMessage('Website removed successfully!', 'success');
    } catch (error) {
      console.error('Error removing site:', error);
      this.optionsMain.uiManager.showStatusMessage('Error removing website', 'error');
    }
  }

  /**
   * Clear all blocked sites
   */
  async clearAllBlockedSites() {
    if (confirm('Are you sure you want to remove all blocked websites? This cannot be undone.')) {
      try {
        await saveBlockedWebsites([]);
        await this.loadBlockedSites();
        this.optionsMain.uiManager.showStatusMessage('All websites cleared!', 'success');
      } catch (error) {
        console.error('Error clearing sites:', error);
        this.optionsMain.uiManager.showStatusMessage('Error clearing websites', 'error');
      }
    }
  }

  /**
   * Update sites count display
   * @param {number} count - Number of sites
   */
  updateSitesCount(count) {
    this.optionsMain.sitesCount.textContent = `${count} site${count !== 1 ? 's' : ''} blocked`;
  }
}