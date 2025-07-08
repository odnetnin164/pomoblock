// src/background/BackgroundPomodoroManager.ts
import { PomodoroTimer } from '@shared/pomodoroTimer';
import { TimerStatus, TimerNotification, PomodoroMessage, TimerState } from '@shared/pomodoroTypes';
import { getPomodoroSettings, savePomodoroSettings } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';
import { AudioManager } from '@shared/audioManager';

export class BackgroundPomodoroManager {
  private timer: PomodoroTimer;
  private badgeUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized: boolean = false;
  private audioManager: AudioManager | null = null;
  private previousTimerState: TimerState = 'STOPPED';
  private offscreenDocumentCreated: boolean = false;

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
      logger.info('Initializing BackgroundPomodoroManager', undefined, 'SYSTEM');
      
      // Initialize timer with stored data
      await this.timer.initialize();
      
      // Set up alarm listeners for notifications
      this.setupAlarmListeners();
      
      // Start badge updates
      this.startBadgeUpdates();
      
      // Initial badge update
      this.updateBadge();
      
      // Initialize audio manager if audio is enabled
      const settings = await getPomodoroSettings();
      if (settings.audioEnabled) {
        await this.initializeAudioManager(settings);
      }
      
      this.isInitialized = true;
      logger.info('BackgroundPomodoroManager initialized successfully', undefined, 'SYSTEM');
      
      // Send initialization complete status to all listeners
      await this.broadcastInitializationComplete();
    } catch (error) {
      console.error('Failed to initialize BackgroundPomodoroManager:', error);
      
      // Try to initialize with safe defaults if storage fails
      try {
        logger.warn('Attempting to initialize with safe defaults', undefined, 'SYSTEM');
        
        // Set up alarm listeners anyway
        this.setupAlarmListeners();
        
        // Start badge updates with basic state
        this.startBadgeUpdates();
        
        // Set initial safe state
        this.updateBadge();
        
        // Mark as partially initialized so basic operations work
        this.isInitialized = true;
        logger.warn('BackgroundPomodoroManager initialized with safe defaults', undefined, 'SYSTEM');
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
      logger.debug('BackgroundPomodoroManager received message:', message.type, 'SYSTEM');
      
      this.handleMessage(message)
        .then(response => {
          logger.debug('Message handled successfully:', message.type, 'SYSTEM');
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
          sessionCount: 0,
          nextSessionType: 'WORK',
          nextSessionDuration: 25 * 60
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
            autoStartRest: true,
            autoStartWork: true,
            showNotifications: true,
            playSound: true
          }
        };
      }
    }
    
    // Handle legacy IS_TIMER_BLOCKING for backward compatibility
    if (!this.isInitialized && message.type === 'IS_TIMER_BLOCKING') {
      return { blocking: false };
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
        
      case 'ADVANCE_SESSION':
        await this.timer.advanceToNextSession();
        return { success: true };
        
      case 'RESET_TIMER':
        await this.timer.reset();
        return { success: true };
        
      case 'RESET_SESSION_COUNT':
        await this.timer.resetSessionCount();
        return { success: true };
        
      case 'UPDATE_TASK':
        await this.timer.updateCurrentTask(message.task || '');
        return { success: true };
        
      case 'UPDATE_POMODORO_SETTINGS':
        try {
          await this.timer.updateSettings(message.settings);
          await savePomodoroSettings(message.settings);
          
          // Update audio manager if audio settings changed
          if (message.settings.audioEnabled) {
            await this.initializeAudioManager(message.settings);
          }
          
          return { success: true };
        } catch (error) {
          console.error('Error updating pomodoro settings:', error);
          return { error: 'Failed to update settings' };
        }
        
      case 'TEST_SOUND':
        try {
          await this.testSound(message.data.soundId, message.data.volume);
          return { success: true };
        } catch (error) {
          console.error('Error testing sound:', error);
          return { error: 'Failed to test sound' };
        }
        
      case 'TEST_CUSTOM_SOUND':
        try {
          await this.testCustomSound(message.data.soundId, message.data.dataUrl, message.data.volume);
          return { success: true };
        } catch (error) {
          console.error('Error testing custom sound:', error);
          return { error: 'Failed to test custom sound' };
        }
        
      // Legacy support - keep for backward compatibility
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
        logger.info('Pomodoro alarm triggered', undefined, 'TIMER');
        // The timer handles its own completion logic
      }
    });
  }

  /**
   * Handle timer status updates
   */
  private async handleStatusUpdate(status: TimerStatus): Promise<void> {
    logger.info('Timer status updated:', status, 'TIMER');
    
    // Check for session start (transition from STOPPED to WORK or REST)
    if (this.previousTimerState === 'STOPPED' && 
        (status.state === 'WORK' || status.state === 'REST')) {
      logger.debug('Session started, checking audio settings', undefined, 'AUDIO');
      // Play session start audio if audio is enabled
      const settings = await getPomodoroSettings();
      if (settings.audioEnabled || settings.playSound) {
        logger.info('Playing session start audio', undefined, 'AUDIO');
        await this.playCustomAudio('session_start');
      }
    }
    
    // Update previous state for next comparison
    this.previousTimerState = status.state;
    
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
    logger.info('Timer completed:', notification, 'TIMER');
    
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
      
      // Play custom audio if enabled (using offscreen document)
      // This should work when either audioEnabled is true OR when playSound is true
      if (settings.audioEnabled || settings.playSound) {
        await this.playCustomAudio(notification.type);
      }
    } catch (error) {
      console.error('Error handling timer completion:', error);
    }
    
    // Broadcast completion message
    this.broadcastMessage({
      type: 'TIMER_COMPLETE',
      data: { 
        state: this.timer.getStatus().state,
        timerStatus: this.timer.getStatus(),
        notification: notification
      }
    });
  }

  /**
   * Update extension badge
   */
  private updateBadge(): void {
    try {
      const status = this.timer.getStatus();
      const badgeInfo = this.getBadgeInfo(status);
      
      chrome.action.setBadgeText({ text: badgeInfo.text });
      chrome.action.setBadgeBackgroundColor({ color: badgeInfo.color });
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  /**
   * Get badge info based on timer status
   */
  private getBadgeInfo(status: TimerStatus): { text: string; color: string } {
    switch (status.state) {
      case 'STOPPED':
        return { text: '', color: '#4CAF50' };
      case 'WORK':
        return { 
          text: this.formatTimeForBadge(status.timeRemaining), 
          color: '#f44336' 
        };
      case 'REST':
        return { 
          text: this.formatTimeForBadge(status.timeRemaining), 
          color: '#4CAF50' 
        };
      case 'PAUSED':
        return { 
          text: this.formatTimeForBadge(status.timeRemaining), 
          color: '#FF9800' 
        };
      default:
        return { text: '', color: '#4CAF50' };
    }
  }

  /**
   * Format time for badge display (MM:SS)
   */
  private formatTimeForBadge(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Start badge update interval
   */
  private startBadgeUpdates(): void {
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
    }
    
    this.badgeUpdateInterval = setInterval(() => {
      this.updateBadge();
    }, 1000); // Update every second for real-time timer display
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
    logger.info('showNotification() called:', {
      title: notification.title,
      message: notification.message,
      type: notification.type
    }, 'SYSTEM');
    
    try {
      // Generate unique notification ID to avoid conflicts
      const notificationId = `pomoblock_${Date.now()}`;
      
      logger.debug(`Creating browser notification with ID: ${notificationId}`, undefined, 'SYSTEM');
      
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: notification.title,
        message: notification.message,
        priority: 2,
        requireInteraction: false
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          logger.error('Error creating notification:', chrome.runtime.lastError, 'SYSTEM');
        } else {
          logger.info('Browser notification created successfully:', notificationId, 'SYSTEM');
        }
      });
    } catch (error) {
      logger.error('Error showing notification:', error, 'SYSTEM');
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    logger.debug('playNotificationSound() called - using browser notification sound', undefined, 'AUDIO');
    try {
      // Since Web Audio API is not available in service workers,
      // we'll use a different approach or skip sound in background
      // The notification itself will make a sound if the user has notifications enabled
      logger.info('Notification sound requested (handled by browser notification system)', undefined, 'AUDIO');
    } catch (error) {
      logger.error('Could not play notification sound:', error, 'AUDIO');
    }
  }

  /**
   * Broadcast message to all extension contexts
   */
  private broadcastMessage(message: PomodoroMessage): void {
    // Send to all tabs (content scripts)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        }
      });
    });
    
    // Send to popup and other extension pages
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if popup is not open
    });
  }

  /**
   * Check if timer should block sites (legacy method for backward compatibility)
   */
  isTimerBlocking(): boolean {
    if (!this.isInitialized) {
      return false;
    }
    return this.timer.shouldBlockSites();
  }

  /**
   * Get current timer status (updated with all fields)
   */
  getCurrentStatus(): TimerStatus {
    if (!this.isInitialized) {
      return {
        state: 'STOPPED',
        timeRemaining: 0,
        totalTime: 0,
        currentTask: '',
        sessionCount: 0,
        nextSessionType: 'WORK',
        nextSessionDuration: 25 * 60
      };
    }
    return this.timer.getStatus();
  }

  /**
   * Get current timer state
   */
  getCurrentTimerState(): TimerState {
    return this.getCurrentStatus().state;
  }

  /**
   * Broadcast initialization complete with real status
   */
  private async broadcastInitializationComplete(): Promise<void> {
    try {
      const status = this.timer.getStatus();
      logger.debug('Broadcasting initialization complete with status:', status, 'SYSTEM');
      
      // Send to all tabs - this will update popup and content scripts
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'TIMER_INITIALIZATION_COMPLETE',
              data: { timerStatus: status }
            });
          } catch (error) {
            // Tab might not have content script, ignore
          }
        }
      }
      
      // Also try to send to popup if it's open
      try {
        await chrome.runtime.sendMessage({
          type: 'TIMER_INITIALIZATION_COMPLETE',
          data: { timerStatus: status }
        });
      } catch (error) {
        // Popup might not be open, ignore
      }
    } catch (error) {
      console.error('Error broadcasting initialization complete:', error);
    }
  }

  /**
   * Initialize audio manager for custom sounds
   * Note: In Service Worker context, we don't create AudioManager instance
   * Instead, we use offscreen documents for audio playback
   */
  private async initializeAudioManager(settings: any): Promise<void> {
    try {
      // Cleanup existing audio manager if it exists
      if (this.audioManager) {
        this.audioManager.destroy().catch(() => {
          // Ignore cleanup errors
        });
        this.audioManager = null;
      }

      // In Service Worker context, we don't create AudioManager
      // Audio is handled via offscreen documents
      logger.debug('Audio settings configured for Service Worker context', {
        audioEnabled: settings.audioEnabled,
        audioVolume: settings.audioVolume,
        soundTheme: settings.soundTheme
      }, 'AUDIO');
      
    } catch (error) {
      logger.error('Error initializing audio manager:', error, 'AUDIO');
    }
  }

  /**
   * Play custom audio for timer events
   */
  private async playCustomAudio(eventType: string): Promise<void> {
    logger.info(`Audio playback requested for event: ${eventType}`, undefined, 'AUDIO');
    
    try {
      let soundType: 'work_complete' | 'rest_complete' | 'session_start' = 'work_complete';
      
      switch (eventType) {
        case 'work_complete':
          soundType = 'work_complete';
          break;
        case 'rest_complete':
          soundType = 'rest_complete';
          break;
        case 'session_start':
          soundType = 'session_start';
          break;
      }
      
      logger.debug(`Mapped event type '${eventType}' to sound type '${soundType}'`, undefined, 'AUDIO');

      // Get current settings from storage
      const pomodoroSettings = await getPomodoroSettings();
      
      // Create audio settings from pomodoro settings
      const audioSettings = AudioManager.getDefaultSettings();
      audioSettings.enabled = pomodoroSettings.audioEnabled;
      audioSettings.volume = pomodoroSettings.audioVolume || 70;
      audioSettings.soundTheme = pomodoroSettings.soundTheme || 'default';
      
      if (pomodoroSettings.workCompleteSound) {
        audioSettings.sounds.work_complete.id = pomodoroSettings.workCompleteSound;
      }
      if (pomodoroSettings.restCompleteSound) {
        audioSettings.sounds.rest_complete.id = pomodoroSettings.restCompleteSound;
      }
      if (pomodoroSettings.sessionStartSound) {
        audioSettings.sounds.session_start.id = pomodoroSettings.sessionStartSound;
      }

      if (!audioSettings.enabled) {
        logger.info('Audio playback skipped - audio disabled in settings', undefined, 'AUDIO');
        return;
      }
      
      logger.debug(`Audio settings configured:`, {
        enabled: audioSettings.enabled,
        volume: audioSettings.volume,
        soundTheme: audioSettings.soundTheme,
        soundId: audioSettings.sounds[soundType].id
      }, 'AUDIO');

      // Create offscreen document if needed
      logger.debug('Ensuring offscreen document exists for audio playback', undefined, 'AUDIO');
      await this.ensureOffscreenDocument();

      // Send message to offscreen document to play audio
      const soundOption = audioSettings.sounds[soundType];
      logger.debug(`Sending audio playback message to offscreen document:`, {
        soundOption: soundOption,
        volume: audioSettings.volume
      }, 'AUDIO');
      
      const response = await chrome.runtime.sendMessage({
        type: 'PLAY_AUDIO_OFFSCREEN',
        data: {
          soundOption: soundOption,
          volume: audioSettings.volume
        }
      });

      if (response && response.success) {
        logger.info(`Audio played successfully: ${soundType}`, response, 'AUDIO');
      } else {
        logger.error(`Failed to play audio: ${soundType}`, response?.error || response, 'AUDIO');
      }
      
    } catch (error) {
      logger.error('Error playing custom audio:', error, 'AUDIO');
    }
  }

  /**
   * Ensure offscreen document is created for audio playback
   */
  private async ensureOffscreenDocument(): Promise<void> {
    if (this.offscreenDocumentCreated) {
      return;
    }

    try {
      // Check if offscreen API is available
      if (typeof chrome.offscreen === 'undefined') {
        logger.warn('Offscreen API not available, skipping audio setup', undefined, 'AUDIO');
        return;
      }

      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL('offscreen/audio.html')]
      });

      if (existingContexts.length > 0) {
        this.offscreenDocumentCreated = true;
        logger.debug('Offscreen document already exists', undefined, 'AUDIO');
        return;
      }

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen/audio.html'),
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Playing Pomodoro timer audio notifications'
      });

      this.offscreenDocumentCreated = true;
      logger.info('Offscreen document created for audio playback', undefined, 'AUDIO');
    } catch (error) {
      logger.error('Error creating offscreen document:', error, 'AUDIO');
      // If offscreen API is not available, we'll fall back to silent mode
    }
  }

  /**
   * Test a built-in sound
   */
  private async testSound(soundId: string, volume: number): Promise<void> {
    try {
      // Create offscreen document if needed
      await this.ensureOffscreenDocument();

      // Send message to offscreen document to play audio
      const soundOption = {
        id: soundId,
        name: 'Test Sound',
        type: 'built-in' as const
      };
      
      const response = await chrome.runtime.sendMessage({
        type: 'PLAY_AUDIO_OFFSCREEN',
        data: {
          soundOption: soundOption,
          volume: volume
        }
      });

      if (response && response.success) {
        logger.info(`Test sound played successfully: ${soundId}`, undefined, 'AUDIO');
      } else {
        logger.error(`Failed to play test sound: ${soundId}`, response?.error, 'AUDIO');
      }
    } catch (error) {
      logger.error('Error testing sound:', error, 'AUDIO');
    }
  }

  /**
   * Test a custom sound
   */
  private async testCustomSound(soundId: string, dataUrl: string, volume: number): Promise<void> {
    try {
      // Create offscreen document if needed
      await this.ensureOffscreenDocument();

      // Send message to offscreen document to play audio
      const soundOption = {
        id: soundId,
        name: 'Test Custom Sound',
        type: 'custom' as const,
        dataUrl: dataUrl
      };
      
      const response = await chrome.runtime.sendMessage({
        type: 'PLAY_AUDIO_OFFSCREEN',
        data: {
          soundOption: soundOption,
          volume: volume
        }
      });

      if (response && response.success) {
        logger.info(`Test custom sound played successfully: ${soundId}`, undefined, 'AUDIO');
      } else {
        logger.error(`Failed to play test custom sound: ${soundId}`, response?.error, 'AUDIO');
      }
    } catch (error) {
      logger.error('Error testing custom sound:', error, 'AUDIO');
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    logger.info('Destroying BackgroundPomodoroManager', undefined, 'SYSTEM');
    
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
      this.badgeUpdateInterval = null;
    }
    
    if (this.timer) {
      this.timer.destroy();
    }
    
    if (this.audioManager) {
      this.audioManager.destroy().catch(() => {
        // Ignore cleanup errors
      });
      this.audioManager = null;
    }
    
    this.isInitialized = false;
  }
}