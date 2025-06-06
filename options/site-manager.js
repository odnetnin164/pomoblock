// Blocked sites management for options page
import { getBlockedWebsites, addBlockedWebsite, removeBlockedWebsite, clearAllBlockedWebsites } from '../utils/storage-utils.js';
import { cleanURL, isValidDomain } from '../utils/url-utils.js';
import { getSiteType } from '../utils/site-utils.js';
import { showStatusMessage, setInputValidation, updateCounter, confirmAction } from '../utils/ui-utils.js';

export class SiteManager {
  constructor(statusMessageElement) {
    this.statusMessageElement = statusMessageElement;
    this.elements = this.initializeElements();
    this.bindEvents();
    this.loadBlockedSites();
  }

  initializeElements() {
    return {
      newSiteInput: document.getElementById('newSiteInput'),
      addSiteButton: document.getElementById('addSiteButton'),
      blockedSitesList: document.getElementById('blockedSitesList'),
      sitesCount: document.getElementById('sitesCount'),
      clearAllSites: document.getElementById('clearAllSites')
    };
  }

  bindEvents() {
    const { elements } = this;
    
    // Add site events
    elements.addSiteButton.addEventListener('click', () => this.addNewSite());
    elements.newSiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addNewSite();
      }
    });
    
    // Clear all sites event
    elements.clearAllSites.addEventListener('click', () => this.clearAllBlockedSites());
    
    // Input validation
    elements.newSiteInput.addEventListener('input', () => this.validateSiteInput());
    
    // Auto-focus the input
    elements.newSiteInput.focus();
  }

  validateSiteInput() {
    const site = this.elements.newSiteInput.value.trim();
    const isValid = !site || isValidDomain(cleanURL(site));
    setInputValidation(this.elements.newSiteInput, isValid);
    return isValid;
  }

  async loadBlockedSites() {
    try {
      const blockedWebsites = await getBlockedWebsites();
      this.displayBlockedSites(blockedWebsites);
      this.updateSitesCount(blockedWebsites.length);
    } catch (error) {
      showStatusMessage(this.statusMessageElement, 'Error loading blocked sites: ' + error.message, 'error');
    }
  }

  displayBlockedSites(sites) {
    const { elements } = this;
    
    if (sites.length === 0) {
      elements.blockedSitesList.innerHTML = `
        <div class="empty-state">
          <p>No sites blocked yet</p>
          <small>Add a website above to get started</small>
        </div>
      `;
      elements.clearAllSites.disabled = true;
      return;
    }

    elements.clearAllSites.disabled = false;

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

    elements.blockedSitesList.innerHTML = sitesHTML;

    // Add remove button listeners
    elements.blockedSitesList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', () => {
        const siteToDelete = button.getAttribute('data-site');
        this.removeSite(siteToDelete);
      });
    });
  }

  updateSitesCount(count) {
    updateCounter(this.elements.sitesCount, count, 'site', 'sites');
  }

  async addNewSite() {
    const website = this.elements.newSiteInput.value.trim().toLowerCase();
    
    if (!website) {
      showStatusMessage(this.statusMessageElement, 'Please enter a website URL', 'error');
      this.elements.newSiteInput.focus();
      return;
    }

    // Basic URL validation and cleaning
    const cleanedWebsite = cleanURL(website);
    
    if (!isValidDomain(cleanedWebsite)) {
      showStatusMessage(this.statusMessageElement, 'Please enter a valid domain or URL', 'error');
      this.elements.newSiteInput.focus();
      return;
    }

    try {
      const blockedWebsites = await getBlockedWebsites();
      
      if (blockedWebsites.includes(cleanedWebsite)) {
        showStatusMessage(this.statusMessageElement, 'Website is already blocked', 'error');
        return;
      }

      await addBlockedWebsite(cleanedWebsite);
      this.elements.newSiteInput.value = '';
      this.loadBlockedSites();
      showStatusMessage(this.statusMessageElement, 'Website added successfully!', 'success');
      
    } catch (error) {
      showStatusMessage(this.statusMessageElement, 'Error adding website: ' + error.message, 'error');
    }
  }

  async removeSite(siteToDelete) {
    try {
      await removeBlockedWebsite(siteToDelete);
      this.loadBlockedSites();
      showStatusMessage(this.statusMessageElement, 'Website removed successfully!', 'success');
    } catch (error) {
      showStatusMessage(this.statusMessageElement, 'Error removing website: ' + error.message, 'error');
    }
  }

  clearAllBlockedSites() {
    confirmAction(
      'Are you sure you want to remove all blocked websites? This cannot be undone.',
      async () => {
        try {
          await clearAllBlockedWebsites();
          this.loadBlockedSites();
          showStatusMessage(this.statusMessageElement, 'All websites cleared!', 'success');
        } catch (error) {
          showStatusMessage(this.statusMessageElement, 'Error clearing websites: ' + error.message, 'error');
        }
      }
    );
  }
}