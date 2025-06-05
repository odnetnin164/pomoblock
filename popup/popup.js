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

  // Load blocked sites count and current tab info when popup opens
  loadSiteCount();
  getCurrentTabInfo();

  // Add event listeners
  blockCurrentButton.addEventListener('click', blockCurrentSite);
  manageButton.addEventListener('click', openManagePage);
  optionsButton.addEventListener('click', openOptionsPage);

  // Load and display blocked sites count
  function loadSiteCount() {
    chrome.storage.sync.get('blockedWebsitesArray', function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      siteCount.textContent = blockedWebsites.length;
    });
  }

  // Get current tab information
  function getCurrentTabInfo() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        currentTabUrl = tabs[0].url;
        displayCurrentSite(currentTabUrl);
        checkIfAlreadyBlocked();
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
      const subredditMatch = cleanPathname.match(/^\/r\/([^\/]+)/i); // Case insensitive regex
      if (subredditMatch) {
        return `reddit.com/r/${subredditMatch[1].toLowerCase()}`; // Store in lowercase
      }
      return 'reddit.com'; // Block all of Reddit if not in a specific subreddit
    }
    
    // Special handling for YouTube - could block specific channels
    if (cleanHostname === 'youtube.com') {
      const channelMatch = cleanPathname.match(/^\/(c|channel|user)\/([^\/]+)/i); // Case insensitive regex
      if (channelMatch) {
        return `youtube.com/${channelMatch[1].toLowerCase()}/${channelMatch[2].toLowerCase()}`; // Store in lowercase
      }
      return 'youtube.com'; // Block all of YouTube if not on a specific channel
    }
    
    // Special handling for Twitter/X - could block specific users
    if (cleanHostname === 'twitter.com' || cleanHostname === 'x.com') {
      const userMatch = cleanPathname.match(/^\/([^\/]+)$/i); // Case insensitive regex
      if (userMatch && !['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'settings'].includes(userMatch[1].toLowerCase())) {
        return `${cleanHostname}/${userMatch[1].toLowerCase()}`; // Store in lowercase
      }
      return cleanHostname; // Block all of Twitter/X for main pages
    }
    
    // For subdomains, decide whether to block subdomain or main domain
    const parts = cleanHostname.split('.');
    if (parts.length > 2) {
      const mainDomain = parts.slice(-2).join('.');
      const subdomain = parts[0].toLowerCase();
      
      // Block subdomain specifically for certain cases
      if (['mail', 'drive', 'docs', 'sheets', 'slides', 'forms'].includes(subdomain)) {
        return cleanHostname; // Block specific Google services
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

  // Check if the target is already blocked
  function checkIfAlreadyBlocked() {
    if (!targetToBlock) return;
    
    chrome.storage.sync.get('blockedWebsitesArray', function(data) {
      const blockedWebsites = data.blockedWebsitesArray || [];
      isAlreadyBlocked = blockedWebsites.includes(targetToBlock);
      
      if (isAlreadyBlocked) {
        blockCurrentButton.classList.add('already-blocked');
        blockCurrentButton.innerHTML = `
          <span class="btn-icon">✓</span>
          <span class="btn-text">Already Blocked</span>
        `;
        blockCurrentButton.disabled = true;
      }
    });
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

  // Open manage page (options page with focus on blocked sites)
  function openManagePage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
    window.close();
  }

  // Open options page
  function openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
    window.close();
  }
});