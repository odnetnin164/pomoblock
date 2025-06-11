import { TimerStatus, TimerState, PomodoroMessage } from '@shared/pomodoroTypes';
import { formatDuration } from '@shared/pomodoroStorage';
import { PomodoroTimer } from '@shared/pomodoroTimer';

export class PomodoroControl {
  private container: HTMLElement;
  private timerDisplay!: HTMLElement;
  private taskInput!: HTMLInputElement;
  private startBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private statusText!: HTMLElement;
  private sessionCounter!: HTMLElement;
  private progressBar!: HTMLElement;
  private statusUpdateInterval: number | null = null;
  private lastSetSessionInfo: string = '';
  private helperTimer: PomodoroTimer;
  
  private currentStatus: TimerStatus = {
    state: 'STOPPED',
    timeRemaining: 0,
    totalTime: 0,
    currentTask: '',
    sessionCount: 0
  };



  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    // Create helper timer instance for UI logic (no callbacks needed)
    this.helperTimer = new PomodoroTimer();
    this.createPomodoroUI();
    this.setupEventListeners();
    this.setupMessageListener();
    this.loadCurrentStatus();
    this.startStatusPolling();
  }

  /**
   * Start polling for status updates (backup mechanism)
   */
  private startStatusPolling(): void {
    this.statusUpdateInterval = window.setInterval(() => {
      this.loadCurrentStatus();
    }, 1000);
  }

  /**
   * Stop status polling
   */
  private stopStatusPolling(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  /**
   * Create the music player style pomodoro UI
   */
  private createPomodoroUI(): void {
    this.container.innerHTML = `
      <div class="pomodoro-container">
        <!-- Timer Display with Overlay -->
        <div class="timer-section">
          <div class="timer-circle-container">
            <div class="timer-progress-ring">
              <svg class="progress-ring" width="160" height="160">
                <circle
                  class="progress-ring-background"
                  stroke="rgba(255, 255, 255, 0.1)"
                  stroke-width="8"
                  fill="transparent"
                  r="72"
                  cx="80"
                  cy="80"/>
                <circle
                  class="progress-ring-bar"
                  id="progressBar"
                  stroke="#4CAF50"
                  stroke-width="8"
                  fill="transparent"
                  r="72"
                  cx="80"
                  cy="80"
                  stroke-dasharray="452.39"
                  stroke-dashoffset="452.39"
                  transform="rotate(-90 80 80)"/>
              </svg>
              <div class="timer-content">
                <div class="session-info" id="sessionInfo">#1 - Work</div>
                <div class="timer-display" id="timerDisplay">25:00</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Task Input -->
        <div class="task-section">
          <input 
            type="text" 
            id="taskInput" 
            class="task-input" 
            placeholder="What are you working on?"
            maxlength="100"
          >
        </div>
        
        <!-- Music Player Style Controls -->
        <div class="controls-section">
          <div class="player-controls">
            <button id="stopBtn" class="player-btn stop-btn" disabled>
              <span class="player-icon">⏹</span>
            </button>
            <button id="playPauseBtn" class="player-btn play-btn">
              <span class="player-icon">▶</span>
            </button>
            <button id="nextBtn" class="player-btn next-btn">
              <span class="player-icon">⏭</span>
            </button>
          </div>
        </div>
        
        <!-- Session Stats -->
        <div class="stats-section">
          <div class="session-counter" id="sessionCounter">
            Today: 0 sessions
          </div>
        </div>
      </div>
    `;

    // Get DOM references
    this.timerDisplay = document.getElementById('timerDisplay')!;
    this.taskInput = document.getElementById('taskInput') as HTMLInputElement;
    this.startBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;
    this.pauseBtn = this.startBtn; // Same button for both actions
    this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    this.statusText = document.getElementById('sessionInfo')!; // Use session info as status
    this.sessionCounter = document.getElementById('sessionCounter')!;
    this.progressBar = document.getElementById('progressBar')!;
    // Add next button handler
    const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;
    nextBtn.addEventListener('click', () => this.handleNextAction());
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.startBtn.addEventListener('click', () => this.handlePlayPauseAction());
    this.stopBtn.addEventListener('click', () => this.stopTimer());
    
    // Task input changes
    this.taskInput.addEventListener('input', () => this.updateTask());
    this.taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleStartAction();
      }
    });


    // Clean up polling when popup closes/unloads
    window.addEventListener('beforeunload', () => {
      this.stopStatusPolling();
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopStatusPolling();
      } else {
        this.startStatusPolling();
        this.loadCurrentStatus();
      }
    });
  }

  /**
   * Setup message listener for instant timer updates
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TIMER_UPDATE' && message.data.timerStatus) {
        this.updateStatus(message.data.timerStatus);
      } else if (message.type === 'TIMER_COMPLETE') {
        // Refresh status after timer completion
        this.loadCurrentStatus();
      } else if (message.type === 'TIMER_INITIALIZATION_COMPLETE' && message.data.timerStatus) {
        // Background script finished initializing with real session data
        console.log('Timer initialization complete, updating with real session data');
        this.updateStatus(message.data.timerStatus);
      }
      return false; // Don't send response
    });
  }

  /**
   * Load current timer status
   */
  private async loadCurrentStatus(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATUS' });
      if (response.status) {
        this.updateStatus(response.status);
      }
    } catch (error) {
      console.error('Error loading timer status:', error);
    }
  }

  /**
   * Handle play/pause action (combined button)
   */
  private async handlePlayPauseAction(): Promise<void> {
    if (this.currentStatus.state === 'STOPPED') {
      // Start new session
      await this.handleStartAction();
    } else if (this.currentStatus.state === 'PAUSED') {
      // Resume timer
      await this.handleResumeAction();
    } else {
      // Pause timer
      await this.handlePauseAction();
    }
  }

  /**
   * Handle start action (starts next appropriate session)
   */
  private async handleStartAction(): Promise<void> {
    const task = this.taskInput.value.trim();
    
    try {
      if (this.currentStatus.nextSessionType === 'WORK') {
        await chrome.runtime.sendMessage({ 
          type: 'START_WORK', 
          task: task || `Work Session #${this.currentStatus.sessionCount + 1}`
        });
      } else {
        await chrome.runtime.sendMessage({ type: 'START_REST' });
      }
      
      // Immediately refresh status after starting
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  }

  /**
   * Handle resume action
   */
  private async handleResumeAction(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type: 'RESUME_TIMER' });
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error resuming timer:', error);
    }
  }

  /**
   * Handle pause action
   */
  private async handlePauseAction(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  }

  /**
   * Stop timer
   */
  private async stopTimer(): Promise<void> {
    if (!confirm('Are you sure you want to stop the current timer?')) {
      return;
    }
    
    try {
      await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  }

  /**
   * Update task description
   */
  private async updateTask(): Promise<void> {
    const task = this.taskInput.value.trim();
    
    try {
      await chrome.runtime.sendMessage({ 
        type: 'UPDATE_TASK', 
        task: task 
      });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  /**
   * Update UI with timer status
   */
  private updateStatus(status: TimerStatus): void {
    this.currentStatus = status;
    
    // Update helper timer with the actual status so it has correct session info
    this.helperTimer.setStatusForUI(status);
    
    // Update session counter
    this.sessionCounter.textContent = `Today: ${status.sessionCount} sessions completed`;
    
    if (status.state === 'STOPPED') {
      // Timer is stopped - show next session preview
      this.showNextSessionPreview();
    } else {
      // Timer is running - show current session
      this.showCurrentSession(status);
    }
    
    // Update container styling
    this.updateContainerStyling(status.state);
  }

  /**
   * Show preview of next session when timer is stopped
   */
  private showNextSessionPreview(): void {
    // Update helper timer status for UI calculations
    this.helperTimer.setStatusForUI(this.currentStatus);
    
    // Use centralized display logic
    this.timerDisplay.textContent = this.helperTimer.getDisplayTime();
    
    // Update task input using centralized logic
    this.taskInput.disabled = this.helperTimer.shouldDisableTaskInput();
    this.taskInput.placeholder = this.helperTimer.getTaskInputPlaceholder();
    this.taskInput.value = this.helperTimer.getTaskInputValue();
    
    // Update buttons for stopped state
    this.startBtn.disabled = false;
    this.startBtn.innerHTML = `<span class="player-icon">▶</span>`;
    this.startBtn.className = 'player-btn play-btn';
    
    this.stopBtn.disabled = true;
    
    // Hide circular progress
    this.updateCircularProgress(0);
    
    // Update session info using centralized logic
    const sessionInfo = document.getElementById('sessionInfo')!;
    const displayInfo = this.helperTimer.getSessionDisplayInfo();
    sessionInfo.textContent = displayInfo.sessionText;
    this.lastSetSessionInfo = displayInfo.sessionText;
  }

  /**
   * Show current running session
   */
  private showCurrentSession(status: TimerStatus): void {
    // Update timer display
    this.timerDisplay.textContent = formatDuration(status.timeRemaining);
    
    // Preserve the session info that was set when stopped - don't change it
    const sessionInfo = document.getElementById('sessionInfo')!;
    if (this.lastSetSessionInfo && sessionInfo.textContent !== this.lastSetSessionInfo) {
      sessionInfo.textContent = this.lastSetSessionInfo;
    }
    
    // Update task input
    if (status.currentTask && status.currentTask !== this.taskInput.value) {
      this.taskInput.value = status.currentTask;
    }
    
    // Update progress bar
    this.updateProgressBar(status);
    
    // Update controls based on state
    this.updateControlsState(status.state);
  }

  /**
   * Update progress bar
   */
  private updateProgressBar(status: TimerStatus): void {
    // Update helper timer status and use centralized progress calculation
    this.helperTimer.setStatusForUI(status);
    const progress = this.helperTimer.getProgressPercentage();
    this.updateCircularProgress(progress);
  }

  /**
   * Update controls state based on timer state
   */
  private updateControlsState(state: TimerState): void {
    switch (state) {
      case 'WORK':
      case 'REST':
        this.startBtn.disabled = false;
        this.startBtn.innerHTML = `<span class="player-icon">⏸</span>`;
        this.startBtn.className = 'player-btn pause-btn';
        this.stopBtn.disabled = false;
        this.taskInput.disabled = true;
        break;
        
      case 'PAUSED':
        this.startBtn.disabled = false;
        this.startBtn.innerHTML = `<span class="player-icon">▶</span>`;
        this.startBtn.className = 'player-btn play-btn';
        this.stopBtn.disabled = false;
        this.taskInput.disabled = true;
        break;
    }
  }

  /**
   * Update container styling based on timer state
   */
  private updateContainerStyling(state: TimerState): void {
    // Remove all state classes
    this.container.classList.remove('timer-work', 'timer-rest', 'timer-paused', 'timer-stopped');
    
    // Add current state class and update circle color
    switch (state) {
      case 'WORK':
        this.container.classList.add('timer-work');
        this.progressBar.style.stroke = '#f44336';
        break;
      case 'REST':
        this.container.classList.add('timer-rest');
        this.progressBar.style.stroke = '#4CAF50';
        break;
      case 'PAUSED':
        this.container.classList.add('timer-paused');
        this.progressBar.style.stroke = '#FF9800';
        break;
      default:
        this.container.classList.add('timer-stopped');
        this.progressBar.style.stroke = '#9E9E9E';
        break;
    }
  }

  /**
   * Handle next action (skip to next session)
   */
  private async handleNextAction(): Promise<void> {
    // Next button should advance to next session type but not auto-start
    try {
      // If timer is running, stop it first
      if (this.currentStatus.state !== 'STOPPED') {
        await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Send message to advance to next session type (but keep stopped)
      await chrome.runtime.sendMessage({ type: 'ADVANCE_SESSION' });
      
      // Refresh status to show the new session type
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error advancing to next session:', error);
    }
  }

  /**
   * Update circular progress bar
   */
  private updateCircularProgress(progressPercent: number): void {
    const circumference = 2 * Math.PI * 72; // r = 72
    const offset = circumference - (progressPercent / 100) * circumference;
    this.progressBar.style.strokeDashoffset = offset.toString();
  }

  /**
   * Check if timer is currently blocking sites
   */
  isBlocking(): boolean {
    return this.currentStatus.state === 'WORK';
  }

  /**
   * Get current timer status
   */
  getStatus(): TimerStatus {
    return this.currentStatus;
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy(): void {
    this.stopStatusPolling();
    this.helperTimer.destroy();
  }
}