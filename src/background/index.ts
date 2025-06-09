// Background script for PomoBlock extension
// Currently minimal, but can be extended for background tasks

chrome.runtime.onInstalled.addListener(() => {
  console.log('PomoBlock extension installed');
});

// Handle extension icon click (though popup handles most interaction)
chrome.action.onClicked.addListener((tab) => {
  // This only fires if no popup is defined, but we have one
  console.log('Extension icon clicked', tab);
});

// Listen for tab updates to potentially update badge or icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Could implement badge updates here in the future
    // For now, just log
    console.log('Tab updated:', tab.url);
  }
});

// Handle extension uninstall
chrome.runtime.onSuspend.addListener(() => {
  console.log('PomoBlock extension suspending');
});