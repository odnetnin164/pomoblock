document.addEventListener('DOMContentLoaded', function() {
  const statusDisplay = document.getElementById('statusDisplay');
  const siteCount = document.getElementById('siteCount');
  const currentUrl = document.getElementById('currentUrl');
  const blockTarget = document.getElementById('blockTarget');
  const blockCurrentButton = document.getElementById('blockCurrentButton');
  const manageButton = document.getElementById('manageButton');
  const optionsButton = document.getElementById('optionsButton');

  let currentTabUrl = '';
  let targetToBlock = '';
  let isAlreadyBlocked = false;
  let isWhitelisted = false;

  // Load blocked sites count and current tab info when popup opens
  loadSiteCount();
  getCurrentTabInfo();

  // Add event listeners
  blockCurrentButton.addEventListener('click', handleBlockAction);
  manageButton.addEventListener('click', openOptionsPage);
  optionsButton.addEventListener('click', openOptionsPage);

  // Load and display blocked sites count
  function loadSiteCount() {
    chrome.storage.sync.get(['blockedWebsitesArray', 'whitelistedPathsArray'], function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      const whitelistedPaths = data.whitelistedPathsArray || [];
      siteCount.textContent = blockedWebsites.length;
      
      // Also show whitelist count if there are any
      if (whitelistedPaths.length > 0) {
        statusDisplay.innerHTML = `
          <span id="siteCount">${blockedWebsites.length}</span> sites blocked<br>
          <small>${whitelistedPaths.length} paths whitelisted</small>
        `;
      }
    });
  }

  // Get current tab information
  function getCurrentTabInfo() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        currentTabUrl = tabs[0].url;
        displayCurrentSite(currentTabUrl);
        checkCurrentSiteStatus();
      } else {
        currentUrl.textContent = 'Unable to access current page';
        blockCurrentButton.disabled = true;
      }
    });
  }

  // Display current site and determine what to block
  function displayCurrentSite(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      currentUrl.textContent = hostname + (pathname !== '/' ? pathname : '');
      
      // Determine what should be blocked
      targetToBlock = determineBlockTarget(hostname, pathname);
      
      if (targetToBlock) {
        blockTarget.textContent = `Will block: ${targetToBlock}`;
        
        // Add special styling for certain sites
        if (isSpecialSite(hostname)) {
          document.querySelector('.site-info').classList.add('special-site');
        }
      } else {
        blockTarget.textContent = 'Cannot block this page';
        blockCurrentButton.disabled = true;
      }
    } catch (error) {
      currentUrl.textContent = 'Invalid URL';
      blockCurrentButton.disabled = true;
    }
  }

  // Determine what should be blocked based on the URL
  function determineBlockTarget(hostname, pathname) {
    // Skip chrome:// and extension pages
    if (hostname.startsWith('chrome') || hostname.includes('extension')) {
      return null;
    }

    // Remove www. prefix and convert to lowercase for consistent comparison
    const cleanHostname = hostname.replace(/^www\./, '').toLowerCase();
    const cleanPathname = pathname.toLowerCase();
    
    // Special handling for Reddit - block specific subreddits
    if (cleanHostname === 'reddit.com') {
      const subredditMatch = cleanPathname.match(/^\/r\/([^\/]+)/i);
      if (subredditMatch) {
        return `reddit.com/r/${subredditMatch[1].toLowerCase()}`;
      }
      return 'reddit.com';
    }
    
    // Special handling for YouTube - could block specific channels
    if (cleanHostname === 'youtube.com') {
      const channelMatch = cleanPathname.match(/^\/(c|channel|user)\/([^\/]+)/i);
      if (channelMatch) {
        return `youtube.com/${channelMatch[1].toLowerCase()}/${channelMatch[2].toLowerCase()}`;
      }
      return 'youtube.com';
    }
    
    // Special handling for Twitter/X - could block specific users
    if (cleanHostname === 'twitter.com' || cleanHostname === 'x.com') {
      const userMatch = cleanPathname.match(/^\/([^\/]+)$/i);
      if (userMatch && !['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'settings'].includes(userMatch[1].toLowerCase())) {
        return `${cleanHostname}/${userMatch[1].toLowerCase()}`;
      }
      return cleanHostname;
    }
    
    // For subdomains, decide whether to block subdomain or main domain
    const parts = cleanHostname.split('.');
    if (parts.length > 2) {
      const mainDomain = parts.slice(-2).join('.');
      const subdomain = parts[0].toLowerCase();
      
      // Block subdomain specifically for certain cases
      if (['mail', 'drive', 'docs', 'sheets', 'slides', 'forms'].includes(subdomain)) {
        return cleanHostname;
      }
      
      // For most other subdomains, block the main domain
      return mainDomain;
    }
    
    // Default: block the cleaned hostname
    return cleanHostname;
  }

  // Check if this is a special site that needs different handling
  function isSpecialSite(hostname) {
    const specialSites = ['reddit.com', 'youtube.com', 'twitter.com', 'x.com'];
    return specialSites.some(site => hostname.includes(site));
  }

  // Check current site status (blocked/whitelisted)
  function checkCurrentSiteStatus() {
    if (!targetToBlock) return;
    
    chrome.storage.sync.get(['blockedWebsitesArray', 'whitelistedPathsArray'], function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      const whitelistedPaths = data.whitelistedPathsArray || [];
      
      isAlreadyBlocked = blockedWebsites.includes(targetToBlock);
      isWhitelisted = checkIfWhitelisted(targetToBlock, whitelistedPaths);
      
      updateButtonState();
    });
  }

  // Check if the current target is whitelisted
  function checkIfWhitelisted(target, whitelistedPaths) {
    const urlObj = new URL(currentTabUrl);
    const currentHostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    const currentPathname = urlObj.pathname.toLowerCase();
    
    for (const whitelistedPath of whitelistedPaths) {
      const pathLower = whitelistedPath.toLowerCase();
      
      if (pathLower.includes('/')) {
        // Path-specific whitelist
        const [pathDomain, ...pathParts] = pathLower.split('/');
        const pathPath = '/' + pathParts.join('/');
        
        if (currentHostname === pathDomain && currentPathname.startsWith(pathPath)) {
          return true;
        }
      } else {
        // Domain-only whitelist
        if (currentHostname === pathLower || currentHostname.endsWith('.' + pathLower)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Update button state based on current site status
  function updateButtonState() {
    if (isWhitelisted) {
      blockCurrentButton.classList.add('already-blocked');
      blockCurrentButton.innerHTML = `
        <span class="btn-icon">✅</span>
        <span class="btn-text">Whitelisted</span>
      `;
      blockCurrentButton.disabled = true;
      
      // Add info about whitelist status and remove button
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
      document.getElementById('removeWhitelistButton').addEventListener('click', removeFromWhitelist);
      
    } else if (isAlreadyBlocked) {
      blockCurrentButton.classList.add('already-blocked');
      blockCurrentButton.innerHTML = `
        <span class="btn-icon">✓</span>
        <span class="btn-text">Already Blocked</span>
      `;
      blockCurrentButton.disabled = true;
      
    } else {
      // Check if we can suggest whitelisting instead
      if (wouldBeBlockedByExistingRule()) {
        showWhitelistOption();
      }
    }
  }

  // Check if current page would be blocked by an existing broader rule
  function wouldBeBlockedByExistingRule() {
    const urlObj = new URL(currentTabUrl);
    const currentHostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    const currentPathname = urlObj.pathname.toLowerCase();
    
    return new Promise((resolve) => {
      chrome.storage.sync.get('blockedWebsitesArray', function(data) {
        const blockedWebsites = data.blockedWebsitesArray || [];
        
        for (const site of blockedWebsites) {
          const siteLower = site.toLowerCase();
          
          if (siteLower.includes('/')) {
            // Path-based block - check if current path is more specific
            continue;
          } else {
            // Domain-based block - check if current page would be blocked
            if (currentHostname === siteLower || currentHostname.endsWith('.' + siteLower)) {
              resolve(true);
              return;
            }
          }
        }
        resolve(false);
      });
    });
  }

  // Show whitelist option for pages that would be blocked
  function showWhitelistOption() {
    wouldBeBlockedByExistingRule().then(wouldBeBlocked => {
      if (wouldBeBlocked && targetToBlock.includes('/')) {
        // Show option to whitelist this specific path
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
        
        // Add event listener for whitelist button
        document.getElementById('whitelistCurrentButton').addEventListener('click', whitelistCurrentPath);
      }
    });
  }

  // Handle the main block action (could be block or whitelist)
  function handleBlockAction() {
    if (isWhitelisted || isAlreadyBlocked) return;
    blockCurrentSite();
  }

  // Block the current site
  function blockCurrentSite() {
    if (!targetToBlock || isAlreadyBlocked) return;
    
    blockCurrentButton.disabled = true;
    blockCurrentButton.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Adding...</span>
    `;

    chrome.storage.sync.get('blockedWebsitesArray', function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      
      if (!blockedWebsites.includes(targetToBlock)) {
        blockedWebsites.push(targetToBlock);
        
        chrome.storage.sync.set({
          blockedWebsitesArray: blockedWebsites
        }, function() {
          // Success animation
          blockCurrentButton.classList.add('success');
          blockCurrentButton.innerHTML = `
            <span class="btn-icon">✓</span>
            <span class="btn-text">Blocked!</span>
          `;
          
          // Update site count
          loadSiteCount();
          
          // Mark as already blocked
          isAlreadyBlocked = true;
          
          setTimeout(() => {
            blockCurrentButton.classList.remove('success');
            blockCurrentButton.classList.add('already-blocked');
            blockCurrentButton.innerHTML = `
              <span class="btn-icon">✓</span>
              <span class="btn-text">Already Blocked</span>
            `;
          }, 1500);
        });
      }
    });
  }

  // Whitelist the current path
  function whitelistCurrentPath() {
    if (!targetToBlock) return;
    
    const whitelistButton = document.getElementById('whitelistCurrentButton');
    whitelistButton.disabled = true;
    whitelistButton.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Adding...</span>
    `;

    chrome.storage.sync.get('whitelistedPathsArray', function(data) {
      const whitelistedPaths = data.whitelistedPathsArray || [];
      
      if (!whitelistedPaths.includes(targetToBlock)) {
        whitelistedPaths.push(targetToBlock);
        
        chrome.storage.sync.set({
          whitelistedPathsArray: whitelistedPaths
        }, function() {
          // Success animation
          whitelistButton.classList.add('success');
          whitelistButton.innerHTML = `
            <span class="btn-icon">✅</span>
            <span class="btn-text">Whitelisted!</span>
          `;
          
          // Update site count
          loadSiteCount();
          
          // Mark as whitelisted
          isWhitelisted = true;
          
          setTimeout(() => {
            whitelistButton.innerHTML = `
              <span class="btn-icon">✅</span>
              <span class="btn-text">Already Whitelisted</span>
            `;
          }, 1500);
        });
      }
    });
  }

  // Remove current page from whitelist
  function removeFromWhitelist() {
    const removeButton = document.getElementById('removeWhitelistButton');
    removeButton.disabled = true;
    removeButton.innerHTML = `
      <span class="btn-icon">⏳</span>
      <span class="btn-text">Removing...</span>
    `;

    // Find the exact whitelist entry that matches the current page
    chrome.storage.sync.get('whitelistedPathsArray', function(data) {
      const whitelistedPaths = data.whitelistedPathsArray || [];
      const matchingEntry = findMatchingWhitelistEntry(whitelistedPaths);
      
      if (matchingEntry) {
        const updatedPaths = whitelistedPaths.filter(path => path !== matchingEntry);
        
        chrome.storage.sync.set({
          whitelistedPathsArray: updatedPaths
        }, function() {
          // Success animation
          removeButton.classList.add('success');
          removeButton.innerHTML = `
            <span class="btn-icon">✅</span>
            <span class="btn-text">Removed!</span>
          `;
          
          // Update site count
          loadSiteCount();
          
          // Update status
          isWhitelisted = false;
          
          setTimeout(() => {
            // Remove the whitelist notice and show normal block button
            const whitelistNotice = document.querySelector('.whitelist-notice');
            if (whitelistNotice) {
              whitelistNotice.remove();
            }
            
            // Reset main block button
            blockCurrentButton.classList.remove('already-blocked');
            blockCurrentButton.innerHTML = `
              <span class="btn-icon">🚫</span>
              <span class="btn-text">Block This Page</span>
            `;
            blockCurrentButton.disabled = false;
          }, 1500);
        });
      } else {
        // Shouldn't happen, but handle gracefully
        removeButton.innerHTML = `
          <span class="btn-icon">❌</span>
          <span class="btn-text">Not Found</span>
        `;
        setTimeout(() => {
          removeButton.disabled = false;
          removeButton.innerHTML = `
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">Remove from Whitelist</span>
          `;
        }, 2000);
      }
    });
  }

  // Find the exact whitelist entry that matches the current page
  function findMatchingWhitelistEntry(whitelistedPaths) {
    const urlObj = new URL(currentTabUrl);
    const currentHostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    const currentPathname = urlObj.pathname.toLowerCase();
    
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

  // Open options page
  function openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
    window.close();
  }
});