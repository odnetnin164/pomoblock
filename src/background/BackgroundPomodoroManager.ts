// src/background/BackgroundPomodoroManager.ts
import { PomodoroTimer } from '@shared/pomodoroTimer';
import { TimerStatus, TimerNotification, PomodoroMessage } from '@shared/pomodoroTypes';
import { getPomodoroSettings, savePomodoroSettings } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';

export class BackgroundPomodoroManager {
  private timer: PomodoroTimer;
  private badgeUpdateInterval: number | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.timer = new PomodoroTimer(
      (status: TimerStatus) => this.handleStatusUpdate(status),
      (notification: TimerNotification) => this.handleTimerComplete(notification)
    );
    
    // Set up message listeners immediately (before initialization)
    this.setupMessageListeners();
    
    // Initialize asynchronously
    this.init().catch(error => {
      console.error('Error initializing BackgroundPomodoroManager:', error);
    });
  }

  /**
   * Initialize the pomodoro manager
   */
  private async init(): Promise<void> {
    try {
      logger.log('Initializing BackgroundPomodoroManager');
      
      // Initialize timer with stored data
      await this.timer.initialize();
      
      // Set up alarm listeners for notifications
      this.setupAlarmListeners();
      
      // Start badge updates
      this.startBadgeUpdates();
      
      // Initial badge update
      this.updateBadge();
      
      this.isInitialized = true;
      logger.log('BackgroundPomodoroManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BackgroundPomodoroManager:', error);
      
      // Try to initialize with safe defaults if storage fails
      try {
        logger.log('Attempting to initialize with safe defaults');
        
        // Set up alarm listeners anyway
        this.setupAlarmListeners();
        
        // Start badge updates with basic state
        this.startBadgeUpdates();
        
        // Set initial safe state
        this.updateBadge();
        
        // Mark as partially initialized so basic operations work
        this.isInitialized = true;
        logger.log('BackgroundPomodoroManager initialized with safe defaults');
      } catch (fallbackError) {
        console.error('Even fallback initialization failed:', fallbackError);
        this.isInitialized = false;
      }
    }
  }

  /**
   * Set up message listeners for communication with popup/options
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      logger.log('BackgroundPomodoroManager received message:', message.type);
      
      this.handleMessage(message)
        .then(response => {
          logger.log('Message handled successfully:', message.type);
          sendResponse(response);
        })
        .catch(error => {
          console.error('Error handling message:', message.type, error);
          sendResponse({ error: error.message || 'Unknown error' });
        });
      
      return true; // Will respond asynchronously
    });
  }

  /**
   * Handle messages from popup/options pages
   */
  private async handleMessage(message: any): Promise<any> {
    // If not initialized, return appropriate response for status queries
    if (!this.isInitialized && message.type === 'GET_TIMER_STATUS') {
      return { 
        status: {
          state: 'STOPPED',
          timeRemaining: 0,
          totalTime: 0,
          currentTask: '',
          sessionCount: 0
        }
      };
    }
    
    if (!this.isInitialized && message.type === 'GET_POMODORO_SETTINGS') {
      try {
        const settings = await getPomodoroSettings();
        return { settings };
      } catch (error) {
        return { 
          settings: {
            workDuration: 25,
            restDuration: 5,
            longRestDuration: 15,
            longRestInterval: 4,
            autoStartRest: false,
            autoStartWork: false,
            showNotifications: true,
            playSound: true
          }
        };
      }
    }
    
    // For other operations, ensure we're initialized
    if (!this.isInitialized) {
      return { error: 'Timer not initialized yet. Please try again in a moment.' };
    }

    switch (message.type) {
      case 'GET_TIMER_STATUS':
        return { status: this.timer.getStatus() };
        
      case 'GET_POMODORO_SETTINGS':
        return { settings: this.timer.getSettings() };
        
      case 'START_WORK':
        await this.timer.startWork(message.task || '');
        return { success: true };
        
      case 'START_REST':
        await this.timer.startRest();
        return { success: true };
        
      case 'PAUSE_TIMER':
        await this.timer.pause();
        return { success: true };
        
      case 'RESUME_TIMER':
        await this.timer.resume();
        return { success: true };
        
      case 'STOP_TIMER':
        await this.timer.stop();
        return { success: true };
        
      case 'RESET_TIMER':
        await this.timer.reset();
        return { success: true };
        
      case 'UPDATE_TASK':
        await this.timer.updateCurrentTask(message.task || '');
        return { success: true };
        
      case 'UPDATE_POMODORO_SETTINGS':
        try {
          await this.timer.updateSettings(message.settings);
          await savePomodoroSettings(message.settings);
          return { success: true };
        } catch (error) {
          console.error('Error updating pomodoro settings:', error);
          return { error: 'Failed to update settings' };
        }
        
      case 'IS_TIMER_BLOCKING':
        return { blocking: this.timer.shouldBlockSites() };
        
      case 'OPEN_POPUP_FOR_START':
        // Open popup when user clicks start on floating timer
        try {
          await chrome.action.openPopup();
          return { success: true };
        } catch (error) {
          // If popup can't be opened, try to focus existing extension pages
          try {
            const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('*') });
            if (tabs.length > 0 && tabs[0].id) {
              await chrome.tabs.update(tabs[0].id, { active: true });
              return { success: true };
            }
          } catch (tabError) {
            console.error('Error focusing extension tab:', tabError);
          }
          return { success: false, error: 'Could not open popup' };
        }
        
      default:
        console.warn('Unknown message type:', message.type);
        return { error: 'Unknown message type: ' + message.type };
    }
  }

  /**
   * Set up alarm listeners for timer notifications
   */
  private setupAlarmListeners(): void {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'pomodoroNotification') {
        logger.log('Pomodoro alarm triggered');
        // The timer handles its own completion logic
      }
    });
  }

  /**
   * Handle timer status updates
   */
  private handleStatusUpdate(status: TimerStatus): void {
    logger.log('Timer status updated:', status);
    
    // Update extension badge
    this.updateBadge();
    
    // Broadcast status update to all tabs/popup
    this.broadcastMessage({
      type: 'TIMER_UPDATE',
      data: { timerStatus: status }
    });
    
    // Schedule notification if timer is about to complete (last 10 seconds)
    if ((status.state === 'WORK' || status.state === 'REST') && 
        status.timeRemaining <= 10 && status.timeRemaining > 0) {
      this.scheduleNotification(status.timeRemaining);
    }
  }

  /**
   * Handle timer completion
   */
  private async handleTimerComplete(notification: TimerNotification): Promise<void> {
    logger.log('Timer completed:', notification);
    
    try {
      // Show browser notification if enabled
      const settings = await getPomodoroSettings();
      if (settings.showNotifications) {
        this.showNotification(notification);
      }
      
      // Play sound if enabled
      if (settings.playSound) {
        this.playNotificationSound();
      }
    } catch (error) {
      console.error('Error handling timer completion:', error);
    }
    
    // Broadcast completion message
    this.broadcastMessage({
      type: 'TIMER_COMPLETE',
      data: { state: 'STOPPED' }
    });
  }

  /**
   * Update extension badge
   */
  private updateBadge(): void {
    try {
      const status = this.timer.getStatus();
      
      if (status.state === 'STOPPED') {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      } else if (status.state === 'WORK') {
        const minutes = Math.ceil(status.timeRemaining / 60);
        chrome.action.setBadgeText({ text: minutes.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
      } else if (status.state === 'REST') {
        const minutes = Math.ceil(status.timeRemaining / 60);
        chrome.action.setBadgeText({ text: minutes.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      } else if (status.state === 'PAUSED') {
        chrome.action.setBadgeText({ text: '⏸' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
      }
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  /**
   * Start badge update interval
   */
  private startBadgeUpdates(): void {
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
    }
    
    this.badgeUpdateInterval = window.setInterval(() => {
      this.updateBadge();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Schedule notification for timer completion
   */
  private scheduleNotification(secondsUntilComplete: number): void {
    try {
      chrome.alarms.create('pomodoroNotification', {
        delayInMinutes: secondsUntilComplete / 60
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  /**
   * Show browser notification
   */
  private showNotification(notification: TimerNotification): void {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: notification.title,
        message: notification.message,
        priority: 2
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    try {
      // Simple beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      logger.log('Could not play notification sound:', error);
    }
  }

  /**
   * Broadcast message to all extension contexts
   */
  private broadcastMessage(message: PomodoroMessage): void {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        }
      });
    });
    
    // Send to popup if open (but don't log errors if popup is closed)
    try {
      chrome.runtime.sendMessage(message);
    } catch (error) {
      // Ignore error if popup is not open
    }
  }

  /**
   * Check if timer should block sites
   */
  isTimerBlocking(): boolean {
    if (!this.isInitialized) {
      return false;
    }
    return this.timer.shouldBlockSites();
  }

  /**
   * Get current timer status
   */
  getCurrentStatus(): TimerStatus {
    if (!this.isInitialized) {
      return {
        state: 'STOPPED',
        timeRemaining: 0,
        totalTime: 0,
        currentTask: '',
        sessionCount: 0
      };
    }
    return this.timer.getStatus();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    logger.log('Destroying BackgroundPomodoroManager');
    
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
      this.badgeUpdateInterval = null;
    }
    
    if (this.timer) {
      this.timer.destroy();
    }
    
    this.isInitialized = false;
  }
}