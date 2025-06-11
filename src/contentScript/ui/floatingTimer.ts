// src/contentScript/ui/floatingTimer.ts
import { TimerStatus, TimerState } from '@shared/pomodoroTypes';
import { formatDuration } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';
import { DEFAULT_FLOATING_TIMER_SETTINGS, POMODORO_STORAGE_KEYS } from '@shared/constants';
import { PomodoroTimer } from '@shared/pomodoroTimer';

export class FloatingTimer {
  private widget: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private currentStatus: TimerStatus | null = null;
  private isVisible = false;
  private settings = { ...DEFAULT_FLOATING_TIMER_SETTINGS };
  private helperTimer: PomodoroTimer;

  constructor() {
    // Create helper timer instance for UI logic (no callbacks needed)
    this.helperTimer = new PomodoroTimer();
    this.setupEventListeners();
    this.setupTabChangeHandling();
    this.setupBlockedPageEventListeners();
    // Load settings and create widget after settings are loaded
    this.initializeWidget();
  }

  /**
   * Inject CSS for floating timer if not already present
   */
  private injectCSS(): void {
    if (document.getElementById('pomoblock-floating-timer-styles')) {
      return; // CSS already injected
    }

    const link = document.createElement('link');
    link.id = 'pomoblock-floating-timer-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('shared/floating-timer.css');
    document.head.appendChild(link);
  }

  /**
   * Initialize widget with proper settings loading
   */
  private async initializeWidget(): Promise<void> {
    await this.loadSettings();
    this.createWidget();
  }

  /**
   * Load widget settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const data = await chrome.storage.local.get([POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]);
      if (data[POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]) {
        this.settings = { ...this.settings, ...data[POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS] };
      }
    } catch (error) {
      logger.log('Error loading floating timer settings:', error);
    }
  }

  /**
   * Save widget settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({ [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: this.settings });
    } catch (error) {
      logger.log('Error saving floating timer settings:', error);
    }
  }

  /**
   * Create the floating timer widget as a rectangular progress bar
   */
  private createWidget(): void {
    // Remove existing widget if any
    this.removeWidget();

    this.widget = document.createElement('div');
    this.widget.id = 'pomoblock-floating-timer';
    this.widget.style.cssText = `
      position: fixed !important;
      top: ${this.settings.position.y}px !important;
      left: ${this.settings.position.x}px !important;
      width: 280px !important;
      height: 50px !important;
      background: rgba(0, 0, 0, 0.9) !important;
      border: 2px solid rgba(255, 255, 255, 0.3) !important;
      border-radius: 25px !important;
      color: white !important;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
      font-size: 14px !important;
      z-index: 2147483648 !important;
      cursor: move !important;
      user-select: none !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      transition: all 0.3s ease !important;
      display: ${this.isVisible ? 'flex' : 'none'} !important;
      overflow: hidden !important;
      align-items: center !important;
      backdrop-filter: blur(10px) !important;
    `;

    this.updateWidgetContent();
    document.documentElement.appendChild(this.widget);

    // Setup drag functionality
    this.setupDragHandlers();
    
    // Ensure position is within viewport bounds after creation
    setTimeout(() => this.ensureWidgetPosition(), 100);
  }

  /**
   * Update widget content based on current timer status
   */
  private updateWidgetContent(): void {
    if (!this.widget) return;

    if (!this.currentStatus || this.currentStatus.state === 'STOPPED') {
      this.widget.innerHTML = this.getStoppedContent();
    } else {
      this.widget.innerHTML = this.getActiveContent();
    }

    // Update widget styling based on timer state
    this.updateWidgetStyling();
  }

  /**
   * Get content when timer is stopped
   */
  private getStoppedContent(): string {
    // Update helper timer status for UI calculations
    const statusToUse = this.currentStatus || {
      state: 'STOPPED' as const,
      timeRemaining: 0,
      totalTime: 0,
      currentTask: '',
      sessionCount: 0,
      nextSessionType: 'WORK' as const,
      nextSessionDuration: 25 * 60
    };
    this.helperTimer.setStatusForUI(statusToUse);
    
    // Use centralized display logic
    const displayInfo = this.helperTimer.getSessionDisplayInfo();
    const timeDisplay = this.helperTimer.getDisplayTime();
    const sessionText = displayInfo.sessionText.replace(' - Work', ` - ${timeDisplay}`).replace(' - Break', ` - ${timeDisplay}`);
    const nextType = statusToUse.nextSessionType || 'WORK';

    return `
      <div class="timer-bar-content">
        <button class="timer-control-btn" data-action="start" title="Start ${nextType.toLowerCase()} session">
          <span class="control-icon">▶️</span>
        </button>
        <div class="timer-progress-container">
          <div class="timer-progress-bar" style="width: 0%"></div>
          <div class="timer-text-overlay">
            ${displayInfo.sessionIcon} ${sessionText}
          </div>
        </div>
        <button class="timer-close-btn" title="Hide timer">×</button>
      </div>
      
      <style>
        .timer-bar-content {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          position: relative !important;
        }
        
        .timer-control-btn {
          width: 40px !important;
          height: 40px !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.2) !important;
          border: none !important;
          color: white !important;
          font-size: 16px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-left: 5px !important;
          margin-right: 8px !important;
          transition: all 0.2s ease !important;
          flex-shrink: 0 !important;
        }
        
        .timer-control-btn:hover:not(.disabled) {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: scale(1.1) !important;
        }
        
        .timer-control-btn.disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        
        .timer-progress-container {
          flex: 1 !important;
          height: 30px !important;
          position: relative !important;
          background: rgba(255, 255, 255, 0.1) !important;
          border-radius: 15px !important;
          overflow: hidden !important;
          margin-right: 8px !important;
        }
        
        .timer-progress-bar {
          height: 100% !important;
          background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%) !important;
          border-radius: 15px !important;
          transition: width 1s ease !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
        }
        
        .timer-text-overlay {
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          color: white !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
          white-space: nowrap !important;
          z-index: 10 !important;
        }
        
        .timer-close-btn {
          width: 30px !important;
          height: 30px !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.2) !important;
          border: none !important;
          color: white !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-right: 5px !important;
          transition: all 0.2s ease !important;
          flex-shrink: 0 !important;
        }
        
        .timer-close-btn:hover {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: scale(1.1) !important;
        }
      </style>
    `;
  }

  /**
   * Get content when timer is active
   */
  private getActiveContent(): string {
    if (!this.currentStatus) return this.getStoppedContent();

    // Update helper timer status for UI calculations
    this.helperTimer.setStatusForUI(this.currentStatus);
    
    // Use centralized display logic
    const timeDisplay = this.helperTimer.getDisplayTime();
    const progress = this.helperTimer.getProgressPercentage();
    const displayInfo = this.helperTimer.getSessionDisplayInfo();
    const sessionText = displayInfo.sessionText.replace(' - Work', ` - ${timeDisplay}`).replace(' - Break', ` - ${timeDisplay}`);

    // Control button icon
    const controlIcon = this.currentStatus.state === 'PAUSED' ? '▶️' : '⏸️';
    const controlAction = this.currentStatus.state === 'PAUSED' ? 'resume' : 'pause';

    return `
      <div class="timer-bar-content">
        <button class="timer-control-btn" data-action="${controlAction}" title="${controlAction === 'pause' ? 'Pause timer' : 'Resume timer'}">
          <span class="control-icon">${controlIcon}</span>
        </button>
        <div class="timer-progress-container">
          <div class="timer-progress-bar" style="width: ${progress}%"></div>
          <div class="timer-text-overlay">
            ${displayInfo.sessionIcon} ${sessionText}
          </div>
        </div>
        <button class="timer-close-btn" title="Hide timer">×</button>
      </div>
      
      <style>
        .timer-bar-content {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          position: relative !important;
        }
        
        .timer-control-btn {
          width: 40px !important;
          height: 40px !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.2) !important;
          border: none !important;
          color: white !important;
          font-size: 16px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-left: 5px !important;
          margin-right: 8px !important;
          transition: all 0.2s ease !important;
          flex-shrink: 0 !important;
        }
        
        .timer-control-btn:hover {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: scale(1.1) !important;
        }
        
        .timer-progress-container {
          flex: 1 !important;
          height: 30px !important;
          position: relative !important;
          background: rgba(255, 255, 255, 0.1) !important;
          border-radius: 15px !important;
          overflow: hidden !important;
          margin-right: 8px !important;
        }
        
        .timer-progress-bar {
          height: 100% !important;
          background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%) !important;
          border-radius: 15px !important;
          transition: width 1s ease !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
        }
        
        .timer-text-overlay {
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          color: white !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
          white-space: nowrap !important;
          z-index: 10 !important;
          font-family: 'Courier New', monospace !important;
        }
        
        .timer-close-btn {
          width: 30px !important;
          height: 30px !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.2) !important;
          border: none !important;
          color: white !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-right: 5px !important;
          transition: all 0.2s ease !important;
          flex-shrink: 0 !important;
        }
        
        .timer-close-btn:hover {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: scale(1.1) !important;
        }
      </style>
    `;
  }

  /**
   * Update widget styling based on timer state
   */
  private updateWidgetStyling(): void {
    if (!this.widget || !this.currentStatus) return;

    const progressBar = this.widget.querySelector('.timer-progress-bar') as HTMLElement;
    
    switch (this.currentStatus.state) {
      case 'WORK':
        this.widget.style.borderColor = 'rgba(244, 67, 54, 0.6)';
        if (progressBar) {
          progressBar.style.background = 'linear-gradient(90deg, #f44336 0%, #ff6b6b 100%)';
        }
        break;
      case 'REST':
        this.widget.style.borderColor = 'rgba(76, 175, 80, 0.6)';
        if (progressBar) {
          progressBar.style.background = 'linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%)';
        }
        break;
      case 'PAUSED':
        this.widget.style.borderColor = 'rgba(255, 152, 0, 0.6)';
        if (progressBar) {
          progressBar.style.background = 'linear-gradient(90deg, #FF9800 0%, #FFB74D 100%)';
        }
        break;
      default:
        this.widget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        if (progressBar) {
          progressBar.style.background = 'linear-gradient(90deg, #9E9E9E 0%, #BDBDBD 100%)';
        }
        break;
    }
  }

  /**
   * Setup drag handlers for the widget
   */
  private setupDragHandlers(): void {
    if (!this.widget) return;

    const handleMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      
      // Don't start drag if clicking on control buttons
      const target = mouseEvent.target as HTMLElement;
      if (target.classList.contains('timer-control-btn') || 
          target.classList.contains('timer-close-btn') ||
          target.closest('.timer-control-btn') ||
          target.closest('.timer-close-btn')) {
        return;
      }
      
      mouseEvent.preventDefault();
      this.isDragging = true;
      
      const rect = this.widget!.getBoundingClientRect();
      this.dragOffset.x = mouseEvent.clientX - rect.left;
      this.dragOffset.y = mouseEvent.clientY - rect.top;
      
      this.widget!.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      if (!this.isDragging || !this.widget) return;
      
      mouseEvent.preventDefault();
      
      let newX = mouseEvent.clientX - this.dragOffset.x;
      let newY = mouseEvent.clientY - this.dragOffset.y;
      
      // Keep widget within viewport bounds
      const maxX = window.innerWidth - this.widget.offsetWidth;
      const maxY = window.innerHeight - this.widget.offsetHeight;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      this.widget.style.left = newX + 'px';
      this.widget.style.top = newY + 'px';
      
      this.settings.position = { x: newX, y: newY };
    };

    const handleMouseUp = () => {
      this.isDragging = false;
      if (this.widget) {
        this.widget.style.cursor = 'move';
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Save position immediately after dragging
      this.saveSettings();
    };

    this.widget.addEventListener('mousedown', handleMouseDown);
  }

  /**
   * Setup event listeners for widget interactions
   */
  private setupEventListeners(): void {
    // Listen for clicks on the widget
    document.addEventListener('click', (e) => {
      if (!this.widget || !this.widget.contains(e.target as Node)) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      
      if (button?.classList.contains('timer-control-btn') && !button.classList.contains('disabled')) {
        const action = button.getAttribute('data-action');
        if (action === 'pause') {
          this.sendMessage('PAUSE_TIMER');
        } else if (action === 'resume') {
          this.sendMessage('RESUME_TIMER');
        } else if (action === 'start') {
          this.handleStartAction();
        }
      } else if (button?.classList.contains('timer-close-btn')) {
        this.hide();
      }
    });

    // Listen for timer updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TIMER_UPDATE' && message.data.timerStatus) {
        this.updateStatus(message.data.timerStatus);
      } else if (message.type === 'TIMER_COMPLETE') {
        // Refresh status after timer completion
        this.requestTimerStatus();
      } else if (message.type === 'UPDATE_FLOATING_TIMER') {
        // Handle floating timer settings updates
        this.setAlwaysShow(message.alwaysShow);
      }
    });
  }

  /**
   * Setup tab change and visibility handling
   */
  private setupTabChangeHandling(): void {
    // Listen for visibility changes to update when tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isVisible) {
        logger.log('Floating timer: Tab became visible, refreshing status');
        // Refresh timer status when tab becomes visible
        this.requestTimerStatus();
        
        // Reload position settings from storage to sync with other tabs
        this.loadSettings().then(() => {
          this.updateWidgetPosition();
        });
      }
    });

    // Listen for window focus events
    window.addEventListener('focus', () => {
      if (this.isVisible) {
        logger.log('Floating timer: Window focused, refreshing status');
        this.requestTimerStatus();
        // Reload position to sync with other tabs
        this.loadSettings().then(() => {
          this.updateWidgetPosition();
        });
      }
    });

    // Listen for window resize to adjust position if needed
    window.addEventListener('resize', () => {
      if (this.widget && this.isVisible) {
        this.ensureWidgetPosition();
      }
    });

    // Listen for storage changes to sync position across tabs
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]) {
        const newSettings = changes[POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS].newValue;
        if (newSettings && this.widget) {
          logger.log('Floating timer position synced from another tab');
          this.settings = { ...this.settings, ...newSettings };
          this.updateWidgetPosition();
        }
      }
    });
  }

  /**
   * Handle start action (starts next appropriate session)
   */
  private async handleStartAction(): Promise<void> {
    if (!this.currentStatus) return;
    
    try {
      const nextType = this.currentStatus.nextSessionType || 'WORK';
      if (nextType === 'WORK') {
        // Use centralized session display logic to get consistent session numbering
        this.helperTimer.setStatusForUI(this.currentStatus);
        const displayInfo = this.helperTimer.getSessionDisplayInfo();
        await this.sendMessage('START_WORK', { 
          task: `Work Session #${displayInfo.sessionNumber}`
        });
      } else {
        await this.sendMessage('START_REST');
      }
    } catch (error) {
      logger.log('Error starting timer:', error);
    }
  }

  /**
   * Send message to background script
   */
  private async sendMessage(type: string, data?: any): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ type, ...data });
    } catch (error) {
      logger.log('Error sending message:', error);
    }
  }

  /**
   * Request current timer status
   */
  async requestTimerStatus(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATUS' });
      if (response.status) {
        this.updateStatus(response.status);
      }
    } catch (error) {
      logger.log('Error requesting timer status:', error);
      // If extension context is invalid (after reload), try to reinitialize
      if ((error as Error).toString().includes('Extension context invalidated')) {
        logger.log('Extension context invalidated, attempting to reinitialize');
        this.handleExtensionReload();
      }
    }
  }

  /**
   * Update timer status
   */
  updateStatus(status: TimerStatus): void {
    this.currentStatus = status;
    
    // Show widget if timer is active or always show is enabled
    if (status.state !== 'STOPPED' || this.settings.alwaysShow) {
      this.show();
    } else if (!this.settings.alwaysShow) {
      this.hide();
    }
    
    this.updateWidgetContent();
  }

  /**
   * Show the widget
   */
  show(): void {
    this.isVisible = true;
    if (this.widget) {
      this.widget.style.display = 'flex';
    }
  }

  /**
   * Hide the widget
   */
  hide(): void {
    this.isVisible = false;
    if (this.widget) {
      this.widget.style.display = 'none';
    }
  }

  /**
   * Toggle widget visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set always show preference
   */
  setAlwaysShow(alwaysShow: boolean): void {
    this.settings.alwaysShow = alwaysShow;
    this.saveSettings();
    
    if (!alwaysShow && this.currentStatus?.state === 'STOPPED') {
      this.hide();
    } else if (alwaysShow) {
      this.show();
    }
  }

  /**
   * Remove widget from DOM
   */
  private removeWidget(): void {
    if (this.widget) {
      this.widget.remove();
      this.widget = null;
    }
  }

  /**
   * Initialize widget with current timer status
   */
  async initialize(): Promise<void> {
    await this.loadSettings();
    await this.requestTimerStatus();
    
    // Show widget if always show is enabled
    if (this.settings.alwaysShow) {
      this.show();
    }
  }

  /**
   * Update widget position based on current settings
   */
  private updateWidgetPosition(): void {
    if (!this.widget) return;
    
    this.widget.style.left = this.settings.position.x + 'px';
    this.widget.style.top = this.settings.position.y + 'px';
    
    // Ensure it's still within viewport bounds
    this.ensureWidgetPosition();
  }

  /**
   * Ensure widget is positioned correctly within viewport
   */
  private ensureWidgetPosition(): void {
    if (!this.widget) return;
    
    const rect = this.widget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = this.settings.position.x;
    let newY = this.settings.position.y;
    let needsUpdate = false;
    
    // Check if widget is outside viewport bounds
    if (rect.right > viewportWidth) {
      newX = viewportWidth - this.widget.offsetWidth - 10;
      needsUpdate = true;
    }
    if (rect.left < 0) {
      newX = 10;
      needsUpdate = true;
    }
    if (rect.bottom > viewportHeight) {
      newY = viewportHeight - this.widget.offsetHeight - 10;
      needsUpdate = true;
    }
    if (rect.top < 0) {
      newY = 10;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      this.widget.style.left = newX + 'px';
      this.widget.style.top = newY + 'px';
      this.settings.position = { x: newX, y: newY };
      this.saveSettings();
      logger.log('Floating timer position adjusted to stay in viewport');
    }
  }

  /**
   * Handle extension reload (context invalidated)
   */
  private handleExtensionReload(): void {
    logger.log('Handling extension reload for floating timer');
    
    // Try to reconnect after a short delay
    setTimeout(() => {
      this.requestTimerStatus().catch(() => {
        logger.log('Still unable to connect after extension reload');
        // Hide the widget if we can't reconnect
        this.hide();
      });
    }, 1000);
  }

  /**
   * Set up blocked page event listeners
   */
  private setupBlockedPageEventListeners(): void {
    // Listen for blocked page events
    window.addEventListener('pomoblock-page-blocked', (event) => {
      logger.log('Blocked page displayed event received');
      this.ensureVisibilityOnBlockedPage();
    });

    window.addEventListener('pomoblock-page-unblocked', (event) => {
      logger.log('Blocked page removed event received');
      // Timer visibility will be managed by normal status updates
    });
  }

  /**
   * Ensure timer remains visible when blocked page is shown
   */
  private ensureVisibilityOnBlockedPage(): void {
    logger.log('Ensuring floating timer visibility on blocked page');
    
    if (!this.widget) {
      logger.log('Widget does not exist, creating it');
      this.createWidget();
    }

    // Force the widget to be visible if timer is active
    if (this.currentStatus && this.currentStatus.state !== 'STOPPED') {
      logger.log('Timer is active, forcing visibility');
      this.show();
      
      // Ensure z-index is still highest
      if (this.widget) {
        this.widget.style.zIndex = '2147483648';
        this.widget.style.position = 'fixed';
        this.widget.style.pointerEvents = 'auto';
        
        // Force a re-append to ensure it's on top
        if (this.widget.parentNode) {
          this.widget.parentNode.removeChild(this.widget);
        }
        document.documentElement.appendChild(this.widget);
        
        logger.log('Floating timer repositioned and made visible');
      }
    } else if (this.settings.alwaysShow) {
      logger.log('Always show is enabled, forcing visibility');
      this.show();
      
      // Ensure positioning for always show
      if (this.widget) {
        this.widget.style.zIndex = '2147483648';
        this.widget.style.position = 'fixed';
        this.widget.style.pointerEvents = 'auto';
        
        // Force a re-append to ensure it's on top
        if (this.widget.parentNode) {
          this.widget.parentNode.removeChild(this.widget);
        }
        document.documentElement.appendChild(this.widget);
      }
    }
    
    // Update content
    this.updateWidgetContent();
  }

  /**
   * Cleanup widget
   */
  destroy(): void {
    this.removeWidget();
    this.helperTimer.destroy();
  }
}