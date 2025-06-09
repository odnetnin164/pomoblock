// src/background/index.ts
// Background script for PomoBlock extension with integrated Pomodoro Timer

import { BackgroundPomodoroManager } from './BackgroundPomodoroManager';
import { cleanupOldData } from '@shared/pomodoroStorage';

let pomodoroManager: BackgroundPomodoroManager | undefined;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('PomoBlock extension installed');
  
  // Initialize pomodoro manager
  pomodoroManager = new BackgroundPomodoroManager();
  
  // Clean up old data (keep last 90 days)
  try {
    await cleanupOldData();
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
  
  // Request notification permission (with callback for Manifest V3 compatibility)
  try {
    chrome.notifications.getPermissionLevel((level) => {
      console.log('Notification permission level:', level);
    });
  } catch (error) {
    console.log('Notification permission not available');
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('PomoBlock extension starting up');
  if (!pomodoroManager) {
    pomodoroManager = new BackgroundPomodoroManager();
  }
});

// Handle extension icon click (though popup handles most interaction)
chrome.action.onClicked.addListener((tab) => {
  // This only fires if no popup is defined, but we have one
  console.log('Extension icon clicked', tab);
});

// Listen for tab updates to potentially update badge or icon
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if pomodoro timer should block sites
    if (pomodoroManager && pomodoroManager.isTimerBlocking()) {
      console.log('Pomodoro timer is blocking, tab updated:', tab.url);
    }
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward pomodoro-related messages to the pomodoro manager
  if (pomodoroManager) {
    // Let the pomodoro manager handle its own messages
    return true; // Will respond asynchronously
  }
  
  // Return false if no pomodoroManager to handle the message
  return false;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Notification clicked:', notificationId);
  
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
  console.log('Alarm triggered:', alarm.name);
  
  if (alarm.name.startsWith('pomodoro')) {
    // Handle pomodoro-related alarms
    if (pomodoroManager) {
      // The pomodoro manager handles its own alarms
    }
  }
});

// Handle extension suspend
chrome.runtime.onSuspend.addListener(() => {
  console.log('PomoBlock extension suspending');
  
  if (pomodoroManager) {
    pomodoroManager.destroy();
  }
});

// Clean up on extension unload
chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('PomoBlock extension suspend cancelled');
});

// Context menu setup (optional - could add quick timer controls)
chrome.runtime.onInstalled.addListener(() => {
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'startPomodoro':
      if (pomodoroManager) {
        const status = pomodoroManager.getCurrentStatus();
        if (status.state === 'STOPPED') {
          // Send message to start work timer
          chrome.runtime.sendMessage({ type: 'START_WORK', task: 'Quick Start' });
        }
      }
      break;
      
    case 'stopPomodoro':
      if (pomodoroManager) {
        chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
      }
      break;
      
    case 'pomodoroHistory':
      chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
      break;
  }
});

// Export for testing/debugging
if (typeof globalThis !== 'undefined') {
  (globalThis as any).pomodoroManager = pomodoroManager;
}