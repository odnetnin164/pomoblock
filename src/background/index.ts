// src/background/index.ts
// Background script for PomoBlock extension with integrated Pomodoro Timer

import { BackgroundPomodoroManager } from './BackgroundPomodoroManager';
import { cleanupOldData } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';
import { onStorageChanged } from '@shared/storage';

let pomodoroManager: BackgroundPomodoroManager | undefined;

// Initialize pomodoro manager immediately
async function initializePomodoroManager() {
  try {
    logger.info('Initializing PomoBlock background script', undefined, 'SYSTEM');
    pomodoroManager = new BackgroundPomodoroManager();
    logger.info('BackgroundPomodoroManager created successfully', undefined, 'SYSTEM');
  } catch (error) {
    console.error('Error initializing BackgroundPomodoroManager:', error);
  }
}

// Initialize immediately when background script loads
initializePomodoroManager();

// Set up storage listener for immediate broadcast of blocking changes
setupStorageListener();

// Re-initialize on startup (for when browser restarts)
chrome.runtime.onStartup.addListener(async () => {
  logger.info('PomoBlock extension starting up', undefined, 'SYSTEM');
  if (!pomodoroManager) {
    await initializePomodoroManager();
  }
});

// Initialize extension on install/update
chrome.runtime.onInstalled.addListener(async () => {
  logger.info('PomoBlock extension installed/updated', undefined, 'SYSTEM');
  
  // Clean up old data (keep last 90 days)
  try {
    await cleanupOldData();
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
  
  // Request notification permission (with callback for Manifest V3 compatibility)
  try {
    chrome.notifications.getPermissionLevel((level) => {
      logger.debug('Notification permission level:', level, 'SYSTEM');
    });
  } catch (error) {
    logger.debug('Notification permission not available', undefined, 'SYSTEM');
  }
  
  // Create context menus
  setupContextMenus();
});

// Setup storage listener for immediate blocking updates
function setupStorageListener() {
  onStorageChanged((changes, areaName) => {
    if (areaName === 'sync') {
      // Check for blocklist/whitelist changes that need immediate propagation
      const blockingChanges = changes.blockedWebsitesArray || 
                            changes.whitelistedPathsArray || 
                            changes.blockedSitesToggleState || 
                            changes.whitelistedPathsToggleState;
      
      if (blockingChanges) {
        logger.debug('Blocking configuration changed, broadcasting immediate update to all tabs', undefined, 'BLOCKING');
        
        // Broadcast immediate update message to all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'BLOCKING_CONFIG_CHANGED',
                data: {
                  timestamp: Date.now(),
                  changes: Object.keys(changes)
                }
              }).catch(() => {
                // Ignore errors for tabs that don't have content script
              });
            }
          });
        });
      }
    }
  });
}

// Setup context menus
function setupContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'startPomodoro',
        title: 'Start Pomodoro Timer',
        contexts: ['action']
      });
      
      chrome.contextMenus.create({
        id: 'stopPomodoro',
        title: 'Stop Timer',
        contexts: ['action']
      });
      
      chrome.contextMenus.create({
        id: 'pomodoroHistory',
        title: 'View History',
        contexts: ['action']
      });
    });
  } catch (error) {
    console.error('Error setting up context menus:', error);
  }
}

// Handle extension icon click (though popup handles most interaction)
chrome.action.onClicked.addListener((tab) => {
  logger.debug('Extension icon clicked', tab, 'UI');
});

// Listen for tab updates to potentially update badge or icon
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if pomodoro timer should block sites
    if (pomodoroManager && pomodoroManager.isTimerBlocking()) {
      logger.debug('Pomodoro timer is blocking, tab updated:', tab.url, 'BLOCKING');
    }
  }
});

// REMOVED: The conflicting message listener that was preventing BackgroundPomodoroManager from working
// The BackgroundPomodoroManager now handles ALL messages

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  logger.debug('Notification clicked:', notificationId, 'UI');
  
  // Open popup when notification is clicked
  chrome.action.openPopup().catch(() => {
    // If popup can't be opened, focus on any existing extension page
    chrome.tabs.query({ url: chrome.runtime.getURL('*') }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.update(tabs[0].id, { active: true });
      }
    });
  });
});

// Handle alarm events for pomodoro notifications
chrome.alarms.onAlarm.addListener((alarm) => {
  logger.debug('Alarm triggered:', alarm.name, 'SYSTEM');
  
  if (alarm.name.startsWith('pomodoro')) {
    // The BackgroundPomodoroManager handles its own alarms
    logger.debug('Pomodoro alarm handled by BackgroundPomodoroManager', undefined, 'TIMER');
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!pomodoroManager) {
    console.error('PomodoroManager not initialized');
    return;
  }
  
  try {
    switch (info.menuItemId) {
      case 'startPomodoro':
        const status = pomodoroManager.getCurrentStatus();
        if (status.state === 'STOPPED') {
          // Send message to start work timer
          await chrome.runtime.sendMessage({ type: 'START_WORK', task: 'Quick Start' });
        }
        break;
        
      case 'stopPomodoro':
        await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
        break;
        
      case 'pomodoroHistory':
        await chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
        break;
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
});

// Handle extension suspend
chrome.runtime.onSuspend.addListener(() => {
  logger.info('PomoBlock extension suspending', undefined, 'SYSTEM');
  
  if (pomodoroManager) {
    pomodoroManager.destroy();
  }
});

// Clean up on extension unload
chrome.runtime.onSuspendCanceled.addListener(() => {
  logger.info('PomoBlock extension suspend cancelled', undefined, 'SYSTEM');
});

