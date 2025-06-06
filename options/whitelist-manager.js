// Whitelist management for options page
import { getWhitelistedPaths, addWhitelistedPath, removeWhitelistedPath, clearAllWhitelistedPaths } from '../utils/storage-utils.js';
import { cleanURL, isValidDomain } from '../utils/url-utils.js';
import { getPathType } from '../utils/site-utils.js';
import { showStatusMessage, setInputValidation, updateCounter, confirmAction } from '../utils/ui-utils.js';

export class WhitelistManager {
  constructor(statusMessageElement) {
    this.statusMessageElement = statusMessageElement;
    this.elements = this.initializeElements();
    this.bindEvents();
    this.loadWhitelistedPaths();
  }

  initializeElements() {
    return {
      newWhitelistInput: document.getElementById('newWhitelistInput'),
      addWhitelistButton: document.getElementById('addWhitelistButton'),
      whitelistedPathsList: document.getElementById('whitelistedPathsList'),
      whitelistCount: document.getElementById('whitelistCount'),
      clearAllWhitelist: document.getElementById('clearAllWhitelist')
    };
  }

  bindEvents() {
    const { elements } = this;
    
    // Add whitelist events
    elements.addWhitelistButton.addEventListener('click', () => this.addNewWhitelistPath());
    elements.newWhitelistInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addNewWhitelistPath();
      }
    });
    
    // Clear all whitelist event
    elements.clearAllWhitelist.addEventListener('click', () => this.clearAllWhitelistedPaths());
    
    // Input validation
    elements.newWhitelistInput.addEventListener('input', () => this.validateWhitelistInput());
  }

  validateWhitelistInput() {
    const path = this.elements.newWhitelistInput.value.trim();
    const isValid = !path || isValidDomain(cleanURL(path));
    setInputValidation(this.elements.newWhitelistInput, isValid);
    return isValid;
  }

  async loadWhitelistedPaths() {
    try {
      const whitelistedPaths = await getWhitelistedPaths();
      this.displayWhitelistedPaths(whitelistedPaths);
      this.updateWhitelistCount(whitelistedPaths.length);
    } catch (error) {
      showStatusMessage(this.statusMessageElement, 'Error loading whitelisted paths: ' + error.message, 'error');
    }
  }

  displayWhitelistedPaths(paths) {
    const { elements } = this;
    
    if (paths.length === 0) {
      elements.whitelistedPathsList.innerHTML = `
        <div class="empty-state">
          <p>No paths whitelisted yet</p>
          <small>Add a whitelisted path above to get started</small>
        </div>
      `;
      elements.clearAllWhitelist.disabled = true;
      return;
    }

    elements.clearAllWhitelist.disabled = false;

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

    elements.whitelistedPathsList.innerHTML = pathsHTML;

    // Add remove button listeners
    elements.whitelistedPathsList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', () => {
        const pathToDelete = button.getAttribute('data-path');
        this.removeWhitelistPath(pathToDelete);
      });
    });
  }

  updateWhitelistCount(count) {
    updateCounter(this.elements.whitelistCount, count, 'path', 'paths');
  }

  async addNewWhitelistPath() {
    const path = this.elements.newWhitelistInput.value.trim().toLowerCase();
    
    if (!path) {
      showStatusMessage(this.statusMessageElement, 'Please enter a path to whitelist', 'error');
      this.elements.newWhitelistInput.focus();
      return;
    }

    // Basic path validation and cleaning
    const cleanedPath = cleanURL(path);
    
    if (!isValidDomain(cleanedPath)) {
      showStatusMessage(this.statusMessageElement, 'Please enter a valid domain/path combination', 'error');
      this.elements.newWhitelistInput.focus();
      return;
    }

    try {
      const whitelistedPaths = await getWhitelistedPaths();
      
      if (whitelistedPaths.includes(cleanedPath)) {
        showStatusMessage(this.statusMessageElement, 'Path is already whitelisted', 'error');
        return;
      }

      await addWhitelistedPath(cleanedPath);
      this.elements.newWhitelistInput.value = '';
      this.loadWhitelistedPaths();
      showStatusMessage(this.statusMessageElement, 'Path whitelisted successfully!', 'success');
      
    } catch (error) {
      showStatusMessage(this.statusMessageElement, 'Error adding whitelisted path: ' + error.message, 'error');
    }
  }

  async removeWhitelistPath(pathToDelete) {
    try {
      await removeWhitelistedPath(pathToDelete);
      this.loadWhitelistedPaths();
      showStatusMessage(this.statusMessageElement, 'Whitelisted path removed successfully!', 'success');
    } catch (error) {
      showStatusMessage(this.statusMessageElement, 'Error removing whitelisted path: ' + error.message, 'error');
    }
  }

  clearAllWhitelistedPaths() {
    confirmAction(
      'Are you sure you want to remove all whitelisted paths? This cannot be undone.',
      async () => {
        try {
          await clearAllWhitelistedPaths();
          this.loadWhitelistedPaths();
          showStatusMessage(this.statusMessageElement, 'All whitelisted paths cleared!', 'success');
        } catch (error) {
          showStatusMessage(this.statusMessageElement, 'Error clearing whitelisted paths: ' + error.message, 'error');
        }
      }
    );
  }
}