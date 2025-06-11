// src/shared/pomodoroTimer.ts
import { TimerState, PomodoroSettings, TimerStatus, PomodoroSession, TimerNotification } from './pomodoroTypes';
import { 
  getPomodoroSettings, 
  getTimerStatus, 
  saveTimerStatus, 
  addCompletedSession, 
  getCurrentSession, 
  saveCurrentSession, 
  generateSessionId,
  getDailyStats,
  formatDuration
} from './pomodoroStorage';
import { logger } from '@shared/logger';

export class PomodoroTimer {
  private settings: PomodoroSettings;
  private status: TimerStatus;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onStatusUpdate?: (status: TimerStatus) => void;
  private onTimerComplete?: (notification: TimerNotification) => void;
  
  constructor(
    onStatusUpdate?: (status: TimerStatus) => void,
    onTimerComplete?: (notification: TimerNotification) => void
  ) {
    this.settings = {
      workDuration: 25,
      restDuration: 5,
      longRestDuration: 15,
      longRestInterval: 4,
      autoStartRest: true,
      autoStartWork: true,
      showNotifications: true,
      playSound: true
    };
    
    this.status = {
      state: 'STOPPED',
      timeRemaining: 0,
      totalTime: 0,
      currentTask: '',
      sessionCount: 0,
      nextSessionType: 'WORK', // Add next session type
      nextSessionDuration: 25 * 60 // Add next session duration
    };
    
    this.onStatusUpdate = onStatusUpdate;
    this.onTimerComplete = onTimerComplete;
  }

  /**
   * Initialize timer with stored data - with improved error handling
   */
  async initialize(): Promise<void> {
    logger.log('Initializing PomodoroTimer');
    
    try {
      // Load settings with fallback to defaults
      try {
        this.settings = await getPomodoroSettings();
        logger.log('Pomodoro settings loaded successfully');
      } catch (error) {
        console.error('Error loading pomodoro settings, using defaults:', error);
        this.settings = {
          workDuration: 25,
          restDuration: 5,
          longRestDuration: 15,
          longRestInterval: 4,
          autoStartRest: true,
          autoStartWork: true,
          showNotifications: true,
          playSound: true
        };
      }
      
      // Load timer status with fallback to defaults
      try {
        this.status = await getTimerStatus();
        logger.log('Timer status loaded successfully');
      } catch (error) {
        console.error('Error loading timer status, using defaults:', error);
        this.status = {
          state: 'STOPPED',
          timeRemaining: 0,
          totalTime: 0,
          currentTask: '',
          sessionCount: 0,
          nextSessionType: 'WORK',
          nextSessionDuration: this.settings.workDuration * 60
        };
      }
      
      // Update session count with today's completed work sessions
      try {
        const dailyStats = await getDailyStats();
        this.status.sessionCount = dailyStats.completedWorkSessions;
        logger.log('Daily stats loaded, session count:', this.status.sessionCount);
      } catch (error) {
        console.error('Error loading daily stats, keeping current session count:', error);
        this.status.sessionCount = this.status.sessionCount || 0;
      }
      
      // If timer is stopped, determine next session
      if (this.status.state === 'STOPPED') {
        this.determineNextSession();
      }
      
      // If timer was running when browser closed, try to restore it
      if (this.status.state === 'WORK' || this.status.state === 'REST') {
        try {
          if (this.status.startTime) {
            const elapsed = Math.floor((Date.now() - this.status.startTime) / 1000);
            this.status.timeRemaining = Math.max(0, this.status.timeRemaining - elapsed);
            
            if (this.status.timeRemaining <= 0) {
              logger.log('Timer should have completed while browser was closed');
              await this.completeCurrentTimer();
            } else {
              logger.log(`Resuming timer with ${this.status.timeRemaining} seconds remaining`);
              this.startTicking();
            }
          } else {
            logger.log('Invalid timer state detected, resetting to stopped');
            this.status.state = 'STOPPED';
            this.status.timeRemaining = 0;
            this.status.totalTime = 0;
            this.determineNextSession();
          }
        } catch (error) {
          console.error('Error restoring timer state, stopping timer:', error);
          this.status.state = 'STOPPED';
          this.status.timeRemaining = 0;
          this.status.totalTime = 0;
          this.status.currentTask = '';
          delete this.status.startTime;
          this.determineNextSession();
        }
      }
      
      // Save current status
      try {
        await this.saveStatus();
        logger.log('Timer status saved successfully');
      } catch (error) {
        console.error('Error saving timer status during initialization:', error);
      }
      
      // Notify status update
      this.notifyStatusUpdate();
      
      logger.log('PomodoroTimer initialized successfully with status:', this.status);
      
    } catch (error) {
      console.error('Critical error during PomodoroTimer initialization:', error);
      
      // Set safe defaults if everything fails
      this.settings = {
        workDuration: 25,
        restDuration: 5,
        longRestDuration: 15,
        longRestInterval: 4,
        autoStartRest: true,
        autoStartWork: true,
        showNotifications: true,
        playSound: true
      };
      
      this.status = {
        state: 'STOPPED',
        timeRemaining: 0,
        totalTime: 0,
        currentTask: '',
        sessionCount: 0,
        nextSessionType: 'WORK',
        nextSessionDuration: 25 * 60
      };
      
      this.notifyStatusUpdate();
      
      logger.log('PomodoroTimer initialized with safe defaults due to errors');
    }
  }

  /**
   * Determine what the next session should be
   */
  private determineNextSession(): void {
    if (this.status.sessionCount === 0 && !this.status.lastCompletedSessionType) {
      // First session of the day should be work
      this.status.nextSessionType = 'WORK';
      this.status.nextSessionDuration = this.settings.workDuration * 60;
    } else if (this.status.lastCompletedSessionType) {
      // Use last completed session type to properly alternate
      if (this.status.lastCompletedSessionType === 'WORK') {
        // Last session was work, so next should be rest
        this.status.nextSessionType = 'REST';
        
        // Determine if it should be a long rest
        const isLongRest = this.status.sessionCount % this.settings.longRestInterval === 0;
        this.status.nextSessionDuration = isLongRest ? 
          this.settings.longRestDuration * 60 : 
          this.settings.restDuration * 60;
      } else {
        // Last session was rest, so next should be work
        this.status.nextSessionType = 'WORK';
        this.status.nextSessionDuration = this.settings.workDuration * 60;
      }
    } else {
      // Fallback: if sessionCount > 0 but no lastCompletedSessionType tracked,
      // assume we need rest next (maintains backward compatibility)
      this.status.nextSessionType = 'REST';
      
      // Determine if it should be a long rest
      const isLongRest = this.status.sessionCount % this.settings.longRestInterval === 0;
      this.status.nextSessionDuration = isLongRest ? 
        this.settings.longRestDuration * 60 : 
        this.settings.restDuration * 60;
    }
    
    logger.log('Next session determined:', {
      type: this.status.nextSessionType,
      duration: this.status.nextSessionDuration,
      sessionCount: this.status.sessionCount
    });
  }

  /**
   * Start work timer
   */
  async startWork(taskDescription: string = ''): Promise<void> {
    if (this.status.state === 'WORK' || this.status.state === 'REST') {
      return; // Timer already running
    }

    // If no task provided, use a default task
    if (!taskDescription) {
      taskDescription = this.getDefaultWorkTask();
    }

    this.status.state = 'WORK';
    this.status.currentTask = taskDescription;
    this.status.timeRemaining = this.settings.workDuration * 60;
    this.status.totalTime = this.status.timeRemaining;
    this.status.startTime = Date.now();

    // Create and save current session
    const session: PomodoroSession = {
      id: generateSessionId(),
      type: 'WORK',
      duration: 0,
      plannedDuration: this.status.totalTime,
      task: taskDescription,
      startTime: this.status.startTime,
      endTime: 0,
      completed: false,
      date: new Date().toISOString().split('T')[0]
    };
    
    await saveCurrentSession(session);
    await this.saveStatus();
    this.startTicking();
    this.notifyStatusUpdate();
  }

  /**
   * Start rest timer
   */
  async startRest(): Promise<void> {
    if (this.status.state === 'WORK' || this.status.state === 'REST') {
      return; // Timer already running
    }

    // Determine if this should be a long rest
    const isLongRest = this.status.sessionCount > 0 && 
                      this.status.sessionCount % this.settings.longRestInterval === 0;
    
    const duration = isLongRest ? this.settings.longRestDuration : this.settings.restDuration;

    this.status.state = 'REST';
    this.status.currentTask = isLongRest ? 'Long Break' : 'Short Break';
    this.status.timeRemaining = duration * 60;
    this.status.totalTime = this.status.timeRemaining;
    this.status.startTime = Date.now();

    // Create and save current session
    const session: PomodoroSession = {
      id: generateSessionId(),
      type: 'REST',
      duration: 0,
      plannedDuration: this.status.totalTime,
      task: this.status.currentTask,
      startTime: this.status.startTime,
      endTime: 0,
      completed: false,
      date: new Date().toISOString().split('T')[0]
    };
    
    await saveCurrentSession(session);
    await this.saveStatus();
    this.startTicking();
    this.notifyStatusUpdate();
  }

  /**
   * Pause current timer
   */
  async pause(): Promise<void> {
    if (this.status.state !== 'WORK' && this.status.state !== 'REST') {
      return;
    }

    this.status.state = 'PAUSED';
    this.stopTicking();
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Resume paused timer
   */
  async resume(): Promise<void> {
    if (this.status.state !== 'PAUSED') {
      return;
    }

    // Determine what state to resume to based on current session
    const currentSession = await getCurrentSession();
    if (currentSession) {
      this.status.state = currentSession.type === 'WORK' ? 'WORK' : 'REST';
      this.status.startTime = Date.now() - (this.status.totalTime - this.status.timeRemaining) * 1000;
      this.startTicking();
      await this.saveStatus();
      this.notifyStatusUpdate();
    }
  }

  /**
   * Stop current timer
   */
  async stop(): Promise<void> {
    const wasRunning = this.status.state === 'WORK' || this.status.state === 'REST';
    
    if (wasRunning) {
      // Complete current session as interrupted
      await this.completeCurrentTimer(false);
    }

    this.status.state = 'STOPPED';
    this.status.timeRemaining = 0;
    this.status.totalTime = 0;
    this.status.currentTask = '';
    delete this.status.startTime;

    // Determine next session
    this.determineNextSession();

    this.stopTicking();
    await saveCurrentSession(null);
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Reset timer and session count
   */
  async reset(): Promise<void> {
    await this.stop();
    this.status.sessionCount = 0;
    
    // After reset, next session should be work
    this.status.nextSessionType = 'WORK';
    this.status.nextSessionDuration = this.settings.workDuration * 60;
    
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Check if sites should be blocked based on timer state
   */
  shouldBlockSites(): boolean {
    return this.status.state === 'WORK';
  }

  shouldUnblockSites(): boolean {
    return this.status.state === 'REST';
  }

  /**
   * Get current timer status
   */
  getStatus(): TimerStatus {
    return { ...this.status };
  }

  /**
   * Get current settings
   */
  getSettings(): PomodoroSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings: PomodoroSettings): Promise<void> {
    this.settings = { ...newSettings };
    
    // If timer is stopped, update next session duration based on new settings
    if (this.status.state === 'STOPPED') {
      if (this.status.nextSessionType === 'WORK') {
        this.status.nextSessionDuration = this.settings.workDuration * 60;
      } else {
        const isLongRest = this.status.sessionCount % this.settings.longRestInterval === 0;
        this.status.nextSessionDuration = isLongRest ? 
          this.settings.longRestDuration * 60 : 
          this.settings.restDuration * 60;
      }
    }
    
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Update current task description
   */
  async updateCurrentTask(task: string): Promise<void> {
    this.status.currentTask = task;
    
    // Update current session if one exists
    const currentSession = await getCurrentSession();
    if (currentSession) {
      currentSession.task = task;
      await saveCurrentSession(currentSession);
    }
    
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Start the tick interval
   */
  private startTicking(): void {
    this.stopTicking();
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Stop the tick interval
   */
  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Timer tick - called every second
   */
  private async tick(): Promise<void> {
    if (this.status.state !== 'WORK' && this.status.state !== 'REST') {
      return;
    }

    this.status.timeRemaining--;

    if (this.status.timeRemaining <= 0) {
      await this.completeCurrentTimer();
    } else {
      await this.saveStatus();
      this.notifyStatusUpdate();
    }
  }

  /**
   * Complete current timer
   */
  private async completeCurrentTimer(completed: boolean = true): Promise<void> {
    const currentSession = await getCurrentSession();
    const wasWork = this.status.state === 'WORK';
    
    if (currentSession) {
      // Calculate actual duration
      const actualDuration = Math.floor((Date.now() - currentSession.startTime) / 1000);
      
      // Update session
      currentSession.endTime = Date.now();
      currentSession.duration = actualDuration;
      currentSession.completed = completed;
      
      // Add to history
      await addCompletedSession(currentSession);
      
      // Update session count if it was a completed work session
      if (currentSession.type === 'WORK' && completed) {
        this.status.sessionCount++;
      }
      
      // Track last completed session type for proper alternation
      if (completed) {
        this.status.lastCompletedSessionType = currentSession.type;
      }
    }

    // Send completion notification
    if (this.onTimerComplete && completed) {
      const notification: TimerNotification = {
        title: wasWork ? 'Work Session Complete!' : 'Break Complete!',
        message: wasWork ? 
          `Time for a break! You completed: ${this.status.currentTask || 'Work session'}` :
          'Break time is over. Ready to get back to work?',
        type: wasWork ? 'work_complete' : 'rest_complete'
      };
      this.onTimerComplete(notification);
    }

    // Stop current timer
    this.status.state = 'STOPPED';
    this.status.timeRemaining = 0;
    this.status.totalTime = 0;
    this.status.currentTask = '';
    delete this.status.startTime;
    
    // Determine next session
    this.determineNextSession();
    
    this.stopTicking();
    await saveCurrentSession(null);
    await this.saveStatus();
    this.notifyStatusUpdate();

    // AUTO-START NEXT TIMER
    if (completed) {
      if (wasWork && this.settings.autoStartRest) {
        // Work session completed -> Start rest period
        logger.log('Auto-starting rest period after work session');
        setTimeout(() => this.startRest(), 2000);
      } else if (!wasWork && this.settings.autoStartWork) {
        // Rest period completed -> Start next work period
        logger.log('Auto-starting work period after rest');
        setTimeout(() => this.startWork(this.getDefaultWorkTask()), 2000);
      }
    }
  }

  /**
   * Get default work task based on session count
   */
  private getDefaultWorkTask(): string {
    const sessionNumber = this.status.sessionCount + 1;
    return `Work Session #${sessionNumber}`;
  }

  /**
   * Save current status to storage
   */
  private async saveStatus(): Promise<void> {
    await saveTimerStatus(this.status);
  }

  /**
   * Notify listeners of status update
   */
  private notifyStatusUpdate(): void {
    if (this.onStatusUpdate) {
      this.onStatusUpdate({ ...this.status });
    }
  }

  /**
   * Advance to next session type without starting the timer
   */
  async advanceToNextSession(): Promise<void> {
    logger.log('Advancing to next session type');
    
    // Stop current timer if running
    if (this.status.state !== 'STOPPED') {
      await this.stop();
    }
    
    // Determine next session type and update session count
    const currentNextType = this.status.nextSessionType || 'WORK';
    
    if (currentNextType === 'WORK') {
      // Advancing to work session
      this.status.nextSessionType = 'REST';
      this.status.sessionCount += 1; // Increment for the work session we're skipping to
      
      // Determine if next break should be long or short
      const isLongBreak = this.status.sessionCount % this.settings.longRestInterval === 0;
      this.status.nextSessionDuration = isLongBreak ? 
        this.settings.longRestDuration * 60 : 
        this.settings.restDuration * 60;
    } else {
      // Advancing to rest session  
      this.status.nextSessionType = 'WORK';
      this.status.nextSessionDuration = this.settings.workDuration * 60;
      // Don't increment session count when advancing to rest
    }
    
    // Update last completed session type for proper alternation
    this.status.lastCompletedSessionType = currentNextType === 'WORK' ? 'REST' : 'WORK';
    
    // Save and notify
    await this.saveStatus();
    this.notifyStatusUpdate();
    
    logger.log('Advanced to next session:', this.status.nextSessionType);
  }

  /**
   * Update status for UI helper calculations (internal use)
   */
  private updateStatusForUI(status: TimerStatus): void {
    this.status = status;
  }

  /**
   * Set status for UI calculations (public method for UI components)
   */
  setStatusForUI(status: TimerStatus): void {
    this.updateStatusForUI(status);
  }

  /**
   * Get formatted session info for UI display
   */
  getSessionDisplayInfo(): { sessionText: string; sessionIcon: string; sessionNumber: number } {
    if (this.status.state === 'STOPPED') {
      // Show next session info
      const nextType = this.status.nextSessionType || 'WORK';
      const sessionNumber = nextType === 'WORK' ? this.status.sessionCount + 1 : this.status.sessionCount;
      const sessionIcon = nextType === 'WORK' ? '🍅' : '☕';
      const sessionText = nextType === 'WORK' ? 
        `#${sessionNumber} - Work` : 
        `#${sessionNumber} - Break`;
      
      return { sessionText, sessionIcon, sessionNumber };
    } else {
      // Show current session info (including when paused)
      let currentSessionType: 'WORK' | 'REST';
      
      if (this.status.state === 'PAUSED') {
        // For paused state, determine what type of session was paused
        // If last completed was REST (or no sessions yet), current is WORK
        // If last completed was WORK, current is REST
        currentSessionType = (this.status.lastCompletedSessionType === 'WORK') ? 'REST' : 'WORK';
      } else {
        // For WORK/REST states, use the current state
        currentSessionType = this.status.state as 'WORK' | 'REST';
      }
      
      const sessionNumber = this.status.sessionCount + (currentSessionType === 'WORK' ? 1 : 0);
      const sessionIcon = currentSessionType === 'WORK' ? '🍅' : '☕';
      const sessionText = currentSessionType === 'WORK' ? 
        `#${sessionNumber} - Work` : 
        `#${sessionNumber} - Break`;
      
      return { sessionText, sessionIcon, sessionNumber };
    }
  }

  /**
   * Get progress percentage for current timer
   */
  getProgressPercentage(): number {
    if (this.status.totalTime > 0) {
      return ((this.status.totalTime - this.status.timeRemaining) / this.status.totalTime) * 100;
    }
    return 0;
  }

  /**
   * Get appropriate task input value for session type
   */
  getTaskInputValue(): string {
    if (this.status.state === 'STOPPED') {
      const nextType = this.status.nextSessionType || 'WORK';
      if (nextType === 'WORK') {
        return this.status.currentTask || '';
      } else {
        // Determine if it's long or short break
        const completedWorkSessions = this.status.sessionCount;
        const isLongBreak = completedWorkSessions > 0 && completedWorkSessions % this.settings.longRestInterval === 0;
        return isLongBreak ? 'Long Break' : 'Short Break';
      }
    } else {
      return this.status.currentTask || '';
    }
  }

  /**
   * Get display time for current or next session
   */
  getDisplayTime(): string {
    if (this.status.state === 'STOPPED') {
      return formatDuration(this.status.nextSessionDuration || 25 * 60);
    } else {
      return formatDuration(this.status.timeRemaining);
    }
  }

  /**
   * Check if task input should be disabled
   */
  shouldDisableTaskInput(): boolean {
    if (this.status.state === 'STOPPED') {
      const nextType = this.status.nextSessionType || 'WORK';
      return nextType !== 'WORK';
    } else {
      return false; // Allow editing when timer is running
    }
  }

  /**
   * Get appropriate task input placeholder
   */
  getTaskInputPlaceholder(): string {
    if (this.status.state === 'STOPPED') {
      const nextType = this.status.nextSessionType || 'WORK';
      return nextType === 'WORK' ? 'What are you working on?' : 'Break time - no task needed';
    } else {
      return 'Task in progress...';
    }
  }

  /**
   * Cleanup timer
   */
  destroy(): void {
    this.stopTicking();
  }
}