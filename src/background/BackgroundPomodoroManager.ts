// src/background/BackgroundPomodoroManager.ts
import { PomodoroTimer } from '@shared/pomodoroTimer';
import { TimerStatus, TimerNotification, PomodoroMessage } from '@shared/pomodoroTypes';
import { getPomodoroSettings, savePomodoroSettings } from '@shared/pomodoroStorage';

export class BackgroundPomodoroManager {
  private timer: PomodoroTimer;
  private badgeUpdateInterval: number | null = null;

  constructor() {
    this.timer = new PomodoroTimer(
      (status) => this.handleStatusUpdate(status),
      (notification) => this.handleTimerComplete(notification)
    );
    
    this.init();
  }

  /**
   * Initialize the pomodoro manager
   */
  private async init(): Promise<void> {
    console.log('Initializing BackgroundPomodoroManager');
    
    // Initialize timer with stored data
    await this.timer.initialize();
    
    // Set up message listeners
    this.setupMessageListeners();
    
    // Set up alarm listeners for notifications
    this.setupAlarmListeners();
    
    // Start badge updates
    this.startBadgeUpdates();
    
    // Initial badge update
    this.updateBadge();
    
    console.log('BackgroundPomodoroManager initialized');
  }

  /**
   * Set up message listeners for communication with popup/options
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message).then(sendResponse).catch(console.error);
      return true; // Will respond asynchronously
    });
  }

  /**
   * Handle messages from popup/options pages
   */
  private async handleMessage(message: any): Promise<any> {
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
        await this.timer.updateSettings(message.settings);
        await savePomodoroSettings(message.settings);
        return { success: true };
        
      case 'IS_TIMER_BLOCKING':
        return { blocking: this.timer.shouldBlockSites() };
        
      case 'OPEN_POPUP_FOR_START':
        // Open popup when user clicks start on floating timer
        try {
          await chrome.action.openPopup();
          return { success: true };
        } catch (error) {
          // If popup can't be opened, try to focus existing extension pages
          const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('*') });
          if (tabs.length > 0 && tabs[0].id) {
            await chrome.tabs.update(tabs[0].id, { active: true });
            return { success: true };
          }
          return { success: false, error: 'Could not open popup' };
        }
        
      default:
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Set up alarm listeners for timer notifications
   */
  private setupAlarmListeners(): void {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'pomodoroNotification') {
        // Handle alarm-based notifications if needed
        console.log('Pomodoro alarm triggered');
      }
    });
  }

  /**
   * Handle timer status updates
   */
  private handleStatusUpdate(status: TimerStatus): void {
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
    console.log('Timer completed:', notification);
    
    // Show browser notification if enabled
    const settings = await getPomodoroSettings();
    if (settings.showNotifications) {
      this.showNotification(notification);
    }
    
    // Play sound if enabled
    if (settings.playSound) {
      this.playNotificationSound();
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
  }

  /**
   * Start badge update interval
   */
  private startBadgeUpdates(): void {
    this.badgeUpdateInterval = window.setInterval(() => {
      this.updateBadge();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Schedule notification for timer completion
   */
  private scheduleNotification(secondsUntilComplete: number): void {
    chrome.alarms.create('pomodoroNotification', {
      delayInMinutes: secondsUntilComplete / 60
    });
  }

  /**
   * Show browser notification
   */
  private showNotification(notification: TimerNotification): void {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: notification.title,
      message: notification.message,
      priority: 2
    });
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    // Create audio context for notification sound
    // Note: In a real implementation, you might want to use the chrome.tts API
    // or play a simple beep sound
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
      console.log('Could not play notification sound:', error);
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
    
    // Send to popup if open
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore error if popup is not open
    });
  }

  /**
   * Check if timer should block sites
   */
  isTimerBlocking(): boolean {
    return this.timer.shouldBlockSites();
  }

  /**
   * Get current timer status
   */
  getCurrentStatus(): TimerStatus {
    return this.timer.getStatus();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
    }
    
    this.timer.destroy();
  }
}