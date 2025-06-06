// Main options script for PomoBlock extension
import { SettingsManager } from './options/settings-manager.js';
import { SiteManager } from './options/site-manager.js';
import { WhitelistManager } from './options/whitelist-manager.js';

document.addEventListener('DOMContentLoaded', function() {
  const statusMessage = document.getElementById('statusMessage');
  
  // Initialize all managers
  const settingsManager = new SettingsManager();
  const siteManager = new SiteManager(statusMessage);
  const whitelistManager = new WhitelistManager(statusMessage);
  
  // Expose managers globally for debugging if needed
  window.pomoBlockManagers = {
    settings: settingsManager,
    sites: siteManager,
    whitelist: whitelistManager
  };
});