import { TimerStatus, TimerState, PomodoroMessage } from '@shared/pomodoroTypes';
import { formatDuration } from '@shared/pomodoroStorage';

export class PomodoroControl {
  private container: HTMLElement;
  private timerDisplay!: HTMLElement;
  private taskInput!: HTMLInputElement;
  private startWorkBtn!: HTMLButtonElement;
  private startRestBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private statusText!: HTMLElement;
  private sessionCounter!: HTMLElement;
  private progressBar!: HTMLElement;
  private statusUpdateInterval: number | null = null;
  
  private currentStatus: TimerStatus = {
    state: 'STOPPED',
    timeRemaining: 0,
    totalTime: 0,
    currentTask: '',
    sessionCount: 0
  };

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.createPomodoroUI();
    this.setupEventListeners();
    this.loadCurrentStatus();
    this.startStatusPolling();
  }

  /**
   * Start polling for status updates
   */
  private startStatusPolling(): void {
    // Poll every 2 seconds when popup is open
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
   * Create the pomodoro UI elements
   */
  private createPomodoroUI(): void {
    this.container.innerHTML = `
      <div class="pomodoro-container">
        <div class="timer-section">
          <div class="timer-display" id="timerDisplay">00:00</div>
          <div class="timer-progress">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="timer-status" id="timerStatus">Ready to start</div>
        </div>
        
        <div class="task-section">
          <input 
            type="text" 
            id="taskInput" 
            class="task-input" 
            placeholder="What are you working on?"
            maxlength="100"
          >
        </div>
        
        <div class="controls-section">
          <div class="primary-controls">
            <button id="startWorkBtn" class="control-btn primary">
              <span class="btn-icon">🍅</span>
              <span class="btn-text">Start Work</span>
            </button>
            <button id="startRestBtn" class="control-btn secondary">
              <span class="btn-icon">☕</span>
              <span class="btn-text">Start Break</span>
            </button>
          </div>
          
          <div class="secondary-controls">
            <button id="pauseBtn" class="control-btn small">⏸️</button>
            <button id="stopBtn" class="control-btn small">⏹️</button>
            <button id="resetBtn" class="control-btn small">🔄</button>
          </div>
        </div>
        
        <div class="stats-section">
          <div class="session-counter" id="sessionCounter">
            Today: 0 sessions completed
          </div>
        </div>
      </div>
    `;

    // Get DOM references
    this.timerDisplay = document.getElementById('timerDisplay')!;
    this.taskInput = document.getElementById('taskInput') as HTMLInputElement;
    this.startWorkBtn = document.getElementById('startWorkBtn') as HTMLButtonElement;
    this.startRestBtn = document.getElementById('startRestBtn') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.statusText = document.getElementById('timerStatus')!;
    this.sessionCounter = document.getElementById('sessionCounter')!;
    this.progressBar = document.getElementById('progressBar')!;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.startWorkBtn.addEventListener('click', () => this.startWork());
    this.startRestBtn.addEventListener('click', () => this.startRest());
    this.pauseBtn.addEventListener('click', () => this.pauseResume());
    this.stopBtn.addEventListener('click', () => this.stopTimer());
    this.resetBtn.addEventListener('click', () => this.resetTimer());
    
    // Task input changes
    this.taskInput.addEventListener('input', () => this.updateTask());
    this.taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.startWork();
      }
    });

    // Clean up polling when popup closes/unloads
    window.addEventListener('beforeunload', () => {
      this.stopStatusPolling();
    });

    // Handle visibility changes (when popup gets hidden/shown)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopStatusPolling();
      } else {
        this.startStatusPolling();
        this.loadCurrentStatus(); // Immediate update when becoming visible
      }
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
   * Start work timer
   */
  private async startWork(): Promise<void> {
    const task = this.taskInput.value.trim();
    
    try {
      await chrome.runtime.sendMessage({ 
        type: 'START_WORK', 
        task: task 
      });
      // Immediately refresh status after starting
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error starting work timer:', error);
    }
  }

  /**
   * Start rest timer
   */
  private async startRest(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type: 'START_REST' });
      // Immediately refresh status after starting
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error starting rest timer:', error);
    }
  }

  /**
   * Pause or resume timer
   */
  private async pauseResume(): Promise<void> {
    try {
      if (this.currentStatus.state === 'PAUSED') {
        await chrome.runtime.sendMessage({ type: 'RESUME_TIMER' });
      } else {
        await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
      }
      // Immediately refresh status after action
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error pausing/resuming timer:', error);
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
      // Immediately refresh status after stopping
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  }

  /**
   * Reset timer and session count
   */
  private async resetTimer(): Promise<void> {
    if (!confirm('Are you sure you want to reset the timer and session count?')) {
      return;
    }
    
    try {
      await chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
      // Immediately refresh status after reset
      setTimeout(() => this.loadCurrentStatus(), 100);
    } catch (error) {
      console.error('Error resetting timer:', error);
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
    
    // Update timer display
    this.timerDisplay.textContent = formatDuration(status.timeRemaining);
    
    // Update task input
    if (status.currentTask && status.currentTask !== this.taskInput.value) {
      this.taskInput.value = status.currentTask;
    }
    
    // Update session counter
    this.sessionCounter.textContent = `Today: ${status.sessionCount} sessions completed`;
    
    // Update progress bar
    this.updateProgressBar(status);
    
    // Update status text and buttons
    this.updateControlsState(status.state);
    
    // Update container styling
    this.updateContainerStyling(status.state);
  }

  /**
   * Update progress bar
   */
  private updateProgressBar(status: TimerStatus): void {
    if (status.totalTime > 0) {
      const progress = ((status.totalTime - status.timeRemaining) / status.totalTime) * 100;
      this.progressBar.style.width = `${progress}%`;
      this.progressBar.style.display = 'block';
    } else {
      this.progressBar.style.width = '0%';
      this.progressBar.style.display = 'none';
    }
  }

  /**
   * Update controls state based on timer state
   */
  private updateControlsState(state: TimerState): void {
    // Reset all button states
    this.startWorkBtn.disabled = false;
    this.startRestBtn.disabled = false;
    this.pauseBtn.disabled = false;
    this.stopBtn.disabled = false;
    this.resetBtn.disabled = false;
    
    // Update button text and states
    switch (state) {
      case 'STOPPED':
        this.statusText.textContent = 'Ready to start';
        this.pauseBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.pauseBtn.innerHTML = '⏸️';
        this.taskInput.disabled = false;
        break;
        
      case 'WORK':
        this.statusText.textContent = 'Work time - Stay focused!';
        this.startWorkBtn.disabled = true;
        this.startRestBtn.disabled = true;
        this.pauseBtn.innerHTML = '⏸️';
        this.taskInput.disabled = true;
        break;
        
      case 'REST':
        this.statusText.textContent = 'Break time - Relax!';
        this.startWorkBtn.disabled = true;
        this.startRestBtn.disabled = true;
        this.pauseBtn.innerHTML = '⏸️';
        this.taskInput.disabled = true;
        break;
        
      case 'PAUSED':
        this.statusText.textContent = 'Timer paused';
        this.startWorkBtn.disabled = true;
        this.startRestBtn.disabled = true;
        this.pauseBtn.innerHTML = '▶️';
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
    
    // Add current state class
    switch (state) {
      case 'WORK':
        this.container.classList.add('timer-work');
        this.progressBar.style.backgroundColor = '#f44336';
        break;
      case 'REST':
        this.container.classList.add('timer-rest');
        this.progressBar.style.backgroundColor = '#4CAF50';
        break;
      case 'PAUSED':
        this.container.classList.add('timer-paused');
        this.progressBar.style.backgroundColor = '#FF9800';
        break;
      default:
        this.container.classList.add('timer-stopped');
        this.progressBar.style.backgroundColor = '#9E9E9E';
        break;
    }
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
  }
}