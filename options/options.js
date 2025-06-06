document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements for settings
  const blockModeRadio = document.getElementById('blockMode');
  const redirectModeRadio = document.getElementById('redirectMode');
  const redirectSettings = document.getElementById('redirectSettings');
  const redirectUrl = document.getElementById('redirectUrl');
  const redirectDelay = document.getElementById('redirectDelay');
  const testRedirect = document.getElementById('testRedirect');
  const extensionEnabled = document.getElementById('extensionEnabled');
  const toggleLabel = document.getElementById('toggleLabel');
  const debugEnabled = document.getElementById('debugEnabled');
  const debugToggleLabel = document.getElementById('debugToggleLabel');
  const saveSettings = document.getElementById('saveSettings');
  const resetSettings = document.getElementById('resetSettings');
  const statusMessage = document.getElementById('statusMessage');
  const suggestionButtons = document.querySelectorAll('.suggestion-btn');
  const presetButtons = document.querySelectorAll('.preset-btn');

  // Get DOM elements for site management
  const newSiteInput = document.getElementById('newSiteInput');
  const addSiteButton = document.getElementById('addSiteButton');
  const blockedSitesList = document.getElementById('blockedSitesList');
  const sitesCount = document.getElementById('sitesCount');
  const clearAllSites = document.getElementById('clearAllSites');

  // Get DOM elements for whitelist management
  const newWhitelistInput = document.getElementById('newWhitelistInput');
  const addWhitelistButton = document.getElementById('addWhitelistButton');
  const whitelistedPathsList = document.getElementById('whitelistedPathsList');
  const whitelistCount = document.getElementById('whitelistCount');
  const clearAllWhitelist = document.getElementById('clearAllWhitelist');

  // Default settings
  const defaultSettings = {
    blockMode: 'block', // 'block' or 'redirect'
    redirectUrl: 'https://www.google.com',
    redirectDelay: 3, // seconds
    extensionEnabled: true,
    debugEnabled: false
  };

  // Load settings and sites when page opens
  loadSettings();
  loadBlockedSites();
  loadWhitelistedPaths();

  // Add event listeners for settings
  blockModeRadio.addEventListener('change', updateRedirectVisibility);
  redirectModeRadio.addEventListener('change', updateRedirectVisibility);
  extensionEnabled.addEventListener('change', updateToggleLabel);
  debugEnabled.addEventListener('change', updateDebugToggleLabel);
  saveSettings.addEventListener('click', saveSettingsToStorage);
  resetSettings.addEventListener('click', resetToDefaults);
  testRedirect.addEventListener('click', testRedirectUrl);
  redirectDelay.addEventListener('input', updatePresetButtons);

  // Add event listeners for site management
  addSiteButton.addEventListener('click', addNewSite);
  newSiteInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addNewSite();
    }
  });
  clearAllSites.addEventListener('click', clearAllBlockedSites);

  // Add event listeners for whitelist management
  addWhitelistButton.addEventListener('click', addNewWhitelistPath);
  newWhitelistInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addNewWhitelistPath();
    }
  });
  clearAllWhitelist.addEventListener('click', clearAllWhitelistedPaths);

  // Add suggestion button listeners
  suggestionButtons.forEach(button => {
    button.addEventListener('click', function() {
      const url = this.getAttribute('data-url');
      redirectUrl.value = url;
      showStatusMessage('URL updated! Remember to save settings.', 'success');
    });
  });

  // Add preset button listeners
  presetButtons.forEach(button => {
    button.addEventListener('click', function() {
      const delay = parseInt(this.getAttribute('data-delay'));
      redirectDelay.value = delay;
      updatePresetButtons();
      showStatusMessage('Delay updated! Remember to save settings.', 'success');
    });
  });

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(['blockMode', 'redirectUrl', 'redirectDelay', 'extensionEnabled', 'debugEnabled'], function(data) {
      const settings = {
        blockMode: data.blockMode || defaultSettings.blockMode,
        redirectUrl: data.redirectUrl || defaultSettings.redirectUrl,
        redirectDelay: data.redirectDelay !== undefined ? data.redirectDelay : defaultSettings.redirectDelay,
        extensionEnabled: data.extensionEnabled !== undefined ? data.extensionEnabled : defaultSettings.extensionEnabled,
        debugEnabled: data.debugEnabled !== undefined ? data.debugEnabled : defaultSettings.debugEnabled
      };

      // Set radio buttons
      if (settings.blockMode === 'block') {
        blockModeRadio.checked = true;
      } else {
        redirectModeRadio.checked = true;
      }

      // Set redirect URL and delay
      redirectUrl.value = settings.redirectUrl;
      redirectDelay.value = settings.redirectDelay;

      // Set extension enabled toggle
      extensionEnabled.checked = settings.extensionEnabled;

      // Set debug enabled toggle
      debugEnabled.checked = settings.debugEnabled;

      // Update UI
      updateRedirectVisibility();
      updateToggleLabel();
      updateDebugToggleLabel();
      updatePresetButtons();
    });
  }

  // Load and display blocked sites
  function loadBlockedSites() {
    chrome.storage.sync.get('blockedWebsitesArray', function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      displayBlockedSites(blockedWebsites);
      updateSitesCount(blockedWebsites.length);
    });
  }

  // Load and display whitelisted paths
  function loadWhitelistedPaths() {
    chrome.storage.sync.get('whitelistedPathsArray', function(data) {
      const whitelistedPaths = data.whitelistedPathsArray || [];
      displayWhitelistedPaths(whitelistedPaths);
      updateWhitelistCount(whitelistedPaths.length);
    });
  }

  // Display the list of blocked sites
  function displayBlockedSites(sites) {
    if (sites.length === 0) {
      blockedSitesList.innerHTML = `
        <div class="empty-state">
          <p>No sites blocked yet</p>
          <small>Add a website above to get started</small>
        </div>
      `;
      clearAllSites.disabled = true;
      return;
    }

    clearAllSites.disabled = false;

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

    blockedSitesList.innerHTML = sitesHTML;

    // Add remove button listeners
    document.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', function() {
        const siteToDelete = this.getAttribute('data-site');
        removeSite(siteToDelete);
      });
    });
  }

  // Display the list of whitelisted paths
  function displayWhitelistedPaths(paths) {
    if (paths.length === 0) {
      whitelistedPathsList.innerHTML = `
        <div class="empty-state">
          <p>No paths whitelisted yet</p>
          <small>Add a whitelisted path above to get started</small>
        </div>
      `;
      clearAllWhitelist.disabled = true;
      return;
    }

    clearAllWhitelist.disabled = false;

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

    whitelistedPathsList.innerHTML = pathsHTML;

    // Add remove button listeners
    whitelistedPathsList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', function() {
        const pathToDelete = this.getAttribute('data-path');
        removeWhitelistPath(pathToDelete);
      });
    });
  }

  // Get site type for display
  function getSiteType(site) {
    if (site.includes('reddit.com/r/')) {
      return 'Subreddit';
    }
    if (site.includes('youtube.com/') && (site.includes('/c/') || site.includes('/channel/') || site.includes('/user/'))) {
      return 'Channel';
    }
    if ((site.includes('twitter.com/') || site.includes('x.com/')) && site.split('/').length === 2) {
      return 'Profile';
    }
    if (site.split('.').length > 2) {
      return 'Subdomain';
    }
    return null;
  }

  // Get path type for display (for whitelist)
  function getPathType(path) {
    if (path.includes('reddit.com/r/')) {
      return 'Subreddit';
    }
    if (path.includes('youtube.com/') && (path.includes('/c/') || path.includes('/channel/') || path.includes('/user/'))) {
      return 'Channel';
    }
    if ((path.includes('twitter.com/') || path.includes('x.com/')) && path.split('/').length === 2) {
      return 'Profile';
    }
    if (path.includes('/')) {
      return 'Path';
    }
    return 'Domain';
  }

  // Add a new site to the blocked list
  function addNewSite() {
    const website = newSiteInput.value.trim().toLowerCase();
    
    if (!website) {
      showStatusMessage('Please enter a website URL', 'error');
      newSiteInput.focus();
      return;
    }

    // Basic URL validation and cleaning
    const cleanedWebsite = cleanURL(website);
    
    if (!isValidDomain(cleanedWebsite)) {
      showStatusMessage('Please enter a valid domain or URL', 'error');
      newSiteInput.focus();
      return;
    }

    chrome.storage.sync.get('blockedWebsitesArray', function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      
      if (blockedWebsites.includes(cleanedWebsite)) {
        showStatusMessage('Website is already blocked', 'error');
        return;
      }

      blockedWebsites.push(cleanedWebsite);
      
      chrome.storage.sync.set({
        blockedWebsitesArray: blockedWebsites
      }, function() {
        newSiteInput.value = '';
        loadBlockedSites();
        showStatusMessage('Website added successfully!', 'success');
      });
    });
  }

  // Add a new path to the whitelist
  function addNewWhitelistPath() {
    const path = newWhitelistInput.value.trim().toLowerCase();
    
    if (!path) {
      showStatusMessage('Please enter a path to whitelist', 'error');
      newWhitelistInput.focus();
      return;
    }

    // Basic path validation and cleaning
    const cleanedPath = cleanURL(path);
    
    if (!isValidPath(cleanedPath)) {
      showStatusMessage('Please enter a valid domain/path combination', 'error');
      newWhitelistInput.focus();
      return;
    }

    chrome.storage.sync.get('whitelistedPathsArray', function(data) {
      const whitelistedPaths = data.whitelistedPathsArray || [];
      
      if (whitelistedPaths.includes(cleanedPath)) {
        showStatusMessage('Path is already whitelisted', 'error');
        return;
      }

      whitelistedPaths.push(cleanedPath);
      
      chrome.storage.sync.set({
        whitelistedPathsArray: whitelistedPaths
      }, function() {
        newWhitelistInput.value = '';
        loadWhitelistedPaths();
        showStatusMessage('Path whitelisted successfully!', 'success');
      });
    });
  }

  // Remove a site from the blocked list
  function removeSite(siteToDelete) {
    chrome.storage.sync.get('blockedWebsitesArray', function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      const updatedSites = blockedWebsites.filter(site => site !== siteToDelete);
      
      chrome.storage.sync.set({
        blockedWebsitesArray: updatedSites
      }, function() {
        loadBlockedSites();
        showStatusMessage('Website removed successfully!', 'success');
      });
    });
  }

  // Remove a path from the whitelist
  function removeWhitelistPath(pathToDelete) {
    chrome.storage.sync.get('whitelistedPathsArray', function(data) {
      const whitelistedPaths = data.whitelistedPathsArray || [];
      const updatedPaths = whitelistedPaths.filter(path => path !== pathToDelete);
      
      chrome.storage.sync.set({
        whitelistedPathsArray: updatedPaths
      }, function() {
        loadWhitelistedPaths();
        showStatusMessage('Whitelisted path removed successfully!', 'success');
      });
    });
  }

  // Clear all blocked sites
  function clearAllBlockedSites() {
    if (confirm('Are you sure you want to remove all blocked websites? This cannot be undone.')) {
      chrome.storage.sync.set({
        blockedWebsitesArray: []
      }, function() {
        loadBlockedSites();
        showStatusMessage('All websites cleared!', 'success');
      });
    }
  }

  // Clear all whitelisted paths
  function clearAllWhitelistedPaths() {
    if (confirm('Are you sure you want to remove all whitelisted paths? This cannot be undone.')) {
      chrome.storage.sync.set({
        whitelistedPathsArray: []
      }, function() {
        loadWhitelistedPaths();
        showStatusMessage('All whitelisted paths cleared!', 'success');
      });
    }
  }

  // Update sites count display
  function updateSitesCount(count) {
    sitesCount.textContent = `${count} site${count !== 1 ? 's' : ''} blocked`;
  }

  // Update whitelist count display
  function updateWhitelistCount(count) {
    whitelistCount.textContent = `${count} path${count !== 1 ? 's' : ''} whitelisted`;
  }

  // Clean and normalize URL input
  function cleanURL(url) {
    // Convert to lowercase for consistent handling
    url = url.toLowerCase();
    
    // Handle special cases for paths (Reddit subreddits, YouTube channels, etc.)
    if (url.includes('reddit.com/r/')) {
      // Extract subreddit path
      const match = url.match(/reddit\.com\/r\/([^\/\?\#]+)/);
      if (match) {
        return `reddit.com/r/${match[1]}`;
      }
    }
    
    if (url.includes('youtube.com/')) {
      // Extract channel path
      const channelMatch = url.match(/youtube\.com\/(c|channel|user)\/([^\/\?\#]+)/);
      if (channelMatch) {
        return `youtube.com/${channelMatch[1]}/${channelMatch[2]}`;
      }
    }
    
    if (url.includes('twitter.com/') || url.includes('x.com/')) {
      // Extract user profile
      const domain = url.includes('twitter.com') ? 'twitter.com' : 'x.com';
      const userMatch = url.match(new RegExp(`${domain.replace('.', '\\.')}\\/([^\/\\?\\#]+)`));
      if (userMatch && !['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'settings'].includes(userMatch[1])) {
        return `${domain}/${userMatch[1]}`;
      }
    }
    
    // For regular domains, remove protocol, www, path, etc.
    let cleanUrl = url;
    cleanUrl = cleanUrl.replace(/^https?:\/\//, '');
    cleanUrl = cleanUrl.replace(/^www\./, '');
    cleanUrl = cleanUrl.split(':')[0];
    cleanUrl = cleanUrl.split('?')[0];
    cleanUrl = cleanUrl.split('#')[0];
    
    return cleanUrl;
  }

  // Enhanced domain validation that supports paths
  function isValidDomain(input) {
    // Check for paths (Reddit, YouTube, Twitter)
    if (input.includes('/')) {
      const parts = input.split('/');
      const domain = parts[0];
      const path = parts.slice(1).join('/');
      
      // Validate domain part
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
      if (!domainRegex.test(domain) || !domain.includes('.')) {
        return false;
      }
      
      // Validate path part (basic check)
      if (path.length === 0) {
        return false;
      }
      
      return true;
    }
    
    // Regular domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
    return domainRegex.test(input) && input.includes('.');
  }

  // Validate path for whitelist (should include domain and path)
  function isValidPath(input) {
    // For whitelist, we allow both domain-only and domain/path combinations
    return isValidDomain(input);
  }

  // Update preset buttons to show active state
  function updatePresetButtons() {
    const currentDelay = parseInt(redirectDelay.value);
    presetButtons.forEach(button => {
      const buttonDelay = parseInt(button.getAttribute('data-delay'));
      if (buttonDelay === currentDelay) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  // Update redirect settings visibility
  function updateRedirectVisibility() {
    if (redirectModeRadio.checked) {
      redirectSettings.classList.add('enabled');
    } else {
      redirectSettings.classList.remove('enabled');
    }
  }

  // Update toggle label
  function updateToggleLabel() {
    if (extensionEnabled.checked) {
      toggleLabel.textContent = 'Extension Enabled';
      toggleLabel.style.opacity = '1';
    } else {
      toggleLabel.textContent = 'Extension Disabled';
      toggleLabel.style.opacity = '0.7';
    }
  }

  // Update debug toggle label
  function updateDebugToggleLabel() {
    if (debugEnabled.checked) {
      debugToggleLabel.textContent = 'Debug Enabled';
      debugToggleLabel.style.opacity = '1';
    } else {
      debugToggleLabel.textContent = 'Debug Disabled';
      debugToggleLabel.style.opacity = '0.7';
    }
  }

  // Save settings to storage
  function saveSettingsToStorage() {
    const settings = {
      blockMode: blockModeRadio.checked ? 'block' : 'redirect',
      redirectUrl: redirectUrl.value.trim(),
      redirectDelay: parseInt(redirectDelay.value) || 0,
      extensionEnabled: extensionEnabled.checked,
      debugEnabled: debugEnabled.checked
    };

    // Validate redirect URL if redirect mode is selected
    if (settings.blockMode === 'redirect') {
      if (!settings.redirectUrl) {
        showStatusMessage('Please enter a redirect URL.', 'error');
        redirectUrl.focus();
        return;
      }

      if (!isValidUrl(settings.redirectUrl)) {
        showStatusMessage('Please enter a valid URL (must start with http:// or https://).', 'error');
        redirectUrl.focus();
        return;
      }
    }

    // Validate redirect delay
    if (settings.redirectDelay < 0 || settings.redirectDelay > 30) {
      showStatusMessage('Redirect delay must be between 0 and 30 seconds.', 'error');
      redirectDelay.focus();
      return;
    }

    // Save to Chrome storage
    chrome.storage.sync.set(settings, function() {
      if (chrome.runtime.lastError) {
        showStatusMessage('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatusMessage('Settings saved successfully!', 'success');
        
        // Animate save button
        const originalText = saveSettings.textContent;
        saveSettings.style.background = '#66BB6A';
        saveSettings.textContent = '✓ SAVED';
        
        setTimeout(() => {
          saveSettings.style.background = '#4CAF50';
          saveSettings.textContent = originalText;
        }, 2000);
      }
    });
  }

  // Reset settings to defaults
  function resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This will not affect your blocked sites list or whitelisted paths.')) {
      chrome.storage.sync.set(defaultSettings, function() {
        if (chrome.runtime.lastError) {
          showStatusMessage('Error resetting settings: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatusMessage('Settings reset to defaults!', 'success');
          loadSettings(); // Reload the UI
        }
      });
    }
  }

  // Test redirect URL
  function testRedirectUrl() {
    const url = redirectUrl.value.trim();
    
    if (!url) {
      showStatusMessage('Please enter a URL to test.', 'error');
      redirectUrl.focus();
      return;
    }

    if (!isValidUrl(url)) {
      showStatusMessage('Please enter a valid URL (must start with http:// or https://).', 'error');
      redirectUrl.focus();
      return;
    }

    // Open URL in new tab to test
    chrome.tabs.create({ url: url, active: false }, function(tab) {
      if (chrome.runtime.lastError) {
        showStatusMessage('Error opening URL: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatusMessage('Test URL opened in new tab!', 'success');
        
        // Animate test button
        const originalText = testRedirect.textContent;
        testRedirect.style.background = '#66BB6A';
        testRedirect.textContent = '✓ OPENED';
        
        setTimeout(() => {
          testRedirect.style.background = '#FF9800';
          testRedirect.textContent = originalText;
        }, 2000);
      }
    });
  }

  // Show status message
  function showStatusMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    
    // Hide message after 5 seconds
    setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 5000);
  }

  // Validate URL format
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // Handle URL input validation for redirect URL
  redirectUrl.addEventListener('input', function() {
    const url = this.value.trim();
    if (url && !isValidUrl(url)) {
      this.style.borderColor = '#f44336';
    } else {
      this.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    }
  });

  // Handle URL input validation for new site input
  newSiteInput.addEventListener('input', function() {
    const site = this.value.trim();
    if (site && !isValidDomain(cleanURL(site))) {
      this.style.borderColor = '#f44336';
    } else {
      this.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    }
  });

  // Handle URL input validation for new whitelist input
  newWhitelistInput.addEventListener('input', function() {
    const path = this.value.trim();
    if (path && !isValidPath(cleanURL(path))) {
      this.style.borderColor = '#f44336';
    } else {
      this.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    }
  });

  // Auto-focus redirect URL when redirect mode is selected
  redirectModeRadio.addEventListener('change', function() {
    if (this.checked) {
      setTimeout(() => {
        redirectUrl.focus();
      }, 300);
    }
  });

  // Auto-focus the new site input
  newSiteInput.focus();
});