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
  getDailyStats
} from './pomodoroStorage';

export class PomodoroTimer {
  private settings: PomodoroSettings;
  private status: TimerStatus;
  private tickInterval: number | null = null;
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
      autoStartRest: false,
      autoStartWork: false,
      showNotifications: true,
      playSound: true
    };
    
    this.status = {
      state: 'STOPPED',
      timeRemaining: 0,
      totalTime: 0,
      currentTask: '',
      sessionCount: 0
    };
    
    this.onStatusUpdate = onStatusUpdate;
    this.onTimerComplete = onTimerComplete;
  }

  /**
   * Initialize timer with stored data
   */
  async initialize(): Promise<void> {
    this.settings = await getPomodoroSettings();
    this.status = await getTimerStatus();
    
    // Update session count with today's completed work sessions
    const dailyStats = await getDailyStats();
    this.status.sessionCount = dailyStats.completedWorkSessions;
    
    // If timer was running when browser closed, restore it
    if (this.status.state === 'WORK' || this.status.state === 'REST') {
      if (this.status.startTime) {
        const elapsed = Math.floor((Date.now() - this.status.startTime) / 1000);
        this.status.timeRemaining = Math.max(0, this.status.timeRemaining - elapsed);
        
        if (this.status.timeRemaining <= 0) {
          // Timer should have completed while browser was closed
          await this.completeCurrentTimer();
        } else {
          // Resume timer
          this.startTicking();
        }
      } else {
        // Invalid state, reset
        this.status.state = 'STOPPED';
        this.status.timeRemaining = 0;
        this.status.totalTime = 0;
      }
    }
    
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Start work timer
   */
  async startWork(taskDescription: string = ''): Promise<void> {
    if (this.status.state === 'WORK' || this.status.state === 'REST') {
      return; // Timer already running
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
    await this.saveStatus();
    this.notifyStatusUpdate();
  }

  /**
   * Check if sites should be blocked based on timer state
   */
  shouldBlockSites(): boolean {
    return this.status.state === 'WORK';
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
    this.tickInterval = window.setInterval(() => {
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
    }

    // Determine what just completed and what should come next
    const wasWork = this.status.state === 'WORK';
    
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
    
    this.stopTicking();
    await saveCurrentSession(null);
    await this.saveStatus();
    this.notifyStatusUpdate();

    // Auto-start next timer if enabled
    if (completed) {
      if (wasWork && this.settings.autoStartRest) {
        setTimeout(() => this.startRest(), 1000);
      } else if (!wasWork && this.settings.autoStartWork) {
        // Don't auto-start work - user should manually start with a new task
        // setTimeout(() => this.startWork(), 1000);
      }
    }
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
   * Cleanup timer
   */
  destroy(): void {
    this.stopTicking();
  }
}