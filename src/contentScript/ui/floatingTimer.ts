// src/contentScript/ui/floatingTimer.ts
import { TimerStatus, TimerState } from '@shared/pomodoroTypes';
import { formatDuration } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';

export class FloatingTimer {
  private widget: HTMLElement | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private currentStatus: TimerStatus | null = null;
  private isVisible = false;
  private settings = {
    alwaysShow: false,
    position: { x: 20, y: 20 },
    minimized: false
  };

  constructor() {
    this.loadSettings();
    this.createWidget();
    this.setupEventListeners();
  }

  /**
   * Load widget settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(['floatingTimerSettings']);
      if (data.floatingTimerSettings) {
        this.settings = { ...this.settings, ...data.floatingTimerSettings };
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
      await chrome.storage.local.set({ floatingTimerSettings: this.settings });
    } catch (error) {
      logger.log('Error saving floating timer settings:', error);
    }
  }

  /**
   * Create the floating timer widget
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
      width: ${this.settings.minimized ? '60px' : '200px'} !important;
      height: ${this.settings.minimized ? '60px' : 'auto'} !important;
      background: rgba(30, 30, 30, 0.95) !important;
      backdrop-filter: blur(10px) !important;
      border: 2px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: ${this.settings.minimized ? '50%' : '12px'} !important;
      color: white !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-size: 12px !important;
      z-index: 2147483646 !important;
      cursor: move !important;
      user-select: none !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.3s ease !important;
      display: ${this.isVisible ? 'block' : 'none'} !important;
      overflow: hidden !important;
    `;

    this.updateWidgetContent();
    document.documentElement.appendChild(this.widget);

    // Setup drag functionality
    this.setupDragHandlers();
  }

  /**
   * Update widget content based on current timer status
   */
  private updateWidgetContent(): void {
    if (!this.widget) return;

    if (this.settings.minimized) {
      this.widget.innerHTML = this.getMinimizedContent();
    } else {
      this.widget.innerHTML = this.getFullContent();
    }

    // Update widget styling based on timer state
    this.updateWidgetStyling();
  }

  /**
   * Get minimized widget content (circular icon)
   */
  private getMinimizedContent(): string {
    if (!this.currentStatus) {
      return `
        <div style="
          width: 100%; 
          height: 100%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 24px;
        ">
          🍅
        </div>
      `;
    }

    const minutes = Math.ceil(this.currentStatus.timeRemaining / 60);
    const icon = this.currentStatus.state === 'WORK' ? '🍅' : 
                 this.currentStatus.state === 'REST' ? '☕' : 
                 this.currentStatus.state === 'PAUSED' ? '⏸️' : '🍅';

    return `
      <div style="
        width: 100%; 
        height: 100%; 
        display: flex; 
        flex-direction: column;
        align-items: center; 
        justify-content: center; 
        font-size: 14px;
        gap: 2px;
      ">
        <div style="font-size: 18px;">${icon}</div>
        <div style="font-size: 10px; font-weight: bold;">${minutes}m</div>
      </div>
    `;
  }

  /**
   * Get full widget content
   */
  private getFullContent(): string {
    if (!this.currentStatus) {
      return `
        <div class="timer-widget-content">
          <div class="timer-header">
            <div class="timer-title">🍅 PomoBlock</div>
            <div class="timer-controls">
              <button class="widget-btn minimize-btn" title="Minimize">−</button>
              <button class="widget-btn close-btn" title="Hide">×</button>
            </div>
          </div>
          <div class="timer-status">Timer Stopped</div>
          <div class="timer-actions">
            <button class="widget-btn start-btn">Start Work</button>
          </div>
        </div>
      `;
    }

    const timeDisplay = formatDuration(this.currentStatus.timeRemaining);
    const progress = this.currentStatus.totalTime > 0 ? 
      ((this.currentStatus.totalTime - this.currentStatus.timeRemaining) / this.currentStatus.totalTime) * 100 : 0;

    const statusText = this.currentStatus.state === 'WORK' ? 'Work Session' :
                      this.currentStatus.state === 'REST' ? 'Break Time' :
                      this.currentStatus.state === 'PAUSED' ? 'Paused' : 'Stopped';

    const actionButtons = this.getActionButtons();

    return `
      <div class="timer-widget-content">
        <div class="timer-header">
          <div class="timer-title">${statusText}</div>
          <div class="timer-controls">
            <button class="widget-btn minimize-btn" title="Minimize">−</button>
            <button class="widget-btn close-btn" title="Hide">×</button>
          </div>
        </div>
        
        <div class="timer-display">${timeDisplay}</div>
        
        <div class="timer-progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        
        ${this.currentStatus.currentTask ? `
          <div class="timer-task">${this.currentStatus.currentTask}</div>
        ` : ''}
        
        <div class="timer-actions">
          ${actionButtons}
        </div>
        
        <div class="session-count">
          Today: ${this.currentStatus.sessionCount} sessions
        </div>
      </div>
      
      <style>
        .timer-widget-content {
          padding: 12px !important;
          color: white !important;
        }
        
        .timer-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 8px !important;
        }
        
        .timer-title {
          font-size: 11px !important;
          font-weight: bold !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }
        
        .timer-controls {
          display: flex !important;
          gap: 4px !important;
        }
        
        .timer-display {
          font-size: 18px !important;
          font-weight: bold !important;
          text-align: center !important;
          margin: 8px 0 !important;
          font-family: 'Courier New', monospace !important;
        }
        
        .timer-progress {
          width: 100% !important;
          height: 4px !important;
          background: rgba(255, 255, 255, 0.2) !important;
          border-radius: 2px !important;
          margin: 8px 0 !important;
          overflow: hidden !important;
        }
        
        .progress-bar {
          height: 100% !important;
          background: #4CAF50 !important;
          border-radius: 2px !important;
          transition: width 1s ease !important;
        }
        
        .timer-task {
          font-size: 10px !important;
          text-align: center !important;
          color: rgba(255, 255, 255, 0.8) !important;
          margin: 6px 0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        
        .timer-actions {
          display: flex !important;
          gap: 4px !important;
          margin: 8px 0 !important;
          justify-content: center !important;
        }
        
        .session-count {
          font-size: 9px !important;
          text-align: center !important;
          color: rgba(255, 255, 255, 0.6) !important;
          margin-top: 6px !important;
        }
        
        .widget-btn {
          background: rgba(255, 255, 255, 0.1) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 4px !important;
          color: white !important;
          padding: 4px 8px !important;
          font-size: 9px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          font-weight: bold !important;
        }
        
        .widget-btn:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          transform: translateY(-1px) !important;
        }
        
        .minimize-btn, .close-btn {
          width: 16px !important;
          height: 16px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 10px !important;
        }
        
        .start-btn {
          background: #4CAF50 !important;
          border-color: #4CAF50 !important;
        }
        
        .pause-btn {
          background: #FF9800 !important;
          border-color: #FF9800 !important;
        }
        
        .stop-btn {
          background: #f44336 !important;
          border-color: #f44336 !important;
        }
      </style>
    `;
  }

  /**
   * Get action buttons based on current timer state
   */
  private getActionButtons(): string {
    if (!this.currentStatus) {
      return '<button class="widget-btn start-btn">Start</button>';
    }

    switch (this.currentStatus.state) {
      case 'WORK':
      case 'REST':
        return `
          <button class="widget-btn pause-btn">Pause</button>
          <button class="widget-btn stop-btn">Stop</button>
        `;
      case 'PAUSED':
        return `
          <button class="widget-btn start-btn">Resume</button>
          <button class="widget-btn stop-btn">Stop</button>
        `;
      default:
        return '<button class="widget-btn start-btn">Start</button>';
    }
  }

  /**
   * Update widget styling based on timer state
   */
  private updateWidgetStyling(): void {
    if (!this.widget || !this.currentStatus) return;

    const progressBar = this.widget.querySelector('.progress-bar') as HTMLElement;
    
    switch (this.currentStatus.state) {
      case 'WORK':
        this.widget.style.borderColor = 'rgba(244, 67, 54, 0.5)';
        if (progressBar) progressBar.style.background = '#f44336';
        break;
      case 'REST':
        this.widget.style.borderColor = 'rgba(76, 175, 80, 0.5)';
        if (progressBar) progressBar.style.background = '#4CAF50';
        break;
      case 'PAUSED':
        this.widget.style.borderColor = 'rgba(255, 152, 0, 0.5)';
        if (progressBar) progressBar.style.background = '#FF9800';
        break;
      default:
        this.widget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        if (progressBar) progressBar.style.background = '#9E9E9E';
        break;
    }
  }

  /**
   * Setup drag handlers for the widget
   */
  private setupDragHandlers(): void {
    if (!this.widget) return;

    const header = this.widget.querySelector('.timer-header') || this.widget;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      this.isDragging = true;
      
      const rect = this.widget!.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      this.widget!.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || !this.widget) return;
      
      e.preventDefault();
      
      let newX = e.clientX - this.dragOffset.x;
      let newY = e.clientY - this.dragOffset.y;
      
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
      
      this.saveSettings();
    };

    header.addEventListener('mousedown', handleMouseDown);
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
      
      if (target.classList.contains('minimize-btn')) {
        this.toggleMinimized();
      } else if (target.classList.contains('close-btn')) {
        this.hide();
      } else if (target.classList.contains('start-btn')) {
        this.handleStartAction();
      } else if (target.classList.contains('pause-btn')) {
        this.sendMessage('PAUSE_TIMER');
      } else if (target.classList.contains('stop-btn')) {
        this.sendMessage('STOP_TIMER');
      } else if (this.settings.minimized) {
        // Double-click to expand when minimized
        this.toggleMinimized();
      }
    });

    // Listen for timer updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TIMER_UPDATE' && message.data.timerStatus) {
        this.updateStatus(message.data.timerStatus);
      } else if (message.type === 'TIMER_COMPLETE') {
        // Refresh status after timer completion
        this.requestTimerStatus();
      }
    });

    // Listen for double-click to expand minimized widget
    document.addEventListener('dblclick', (e) => {
      if (this.widget && this.widget.contains(e.target as Node) && this.settings.minimized) {
        this.toggleMinimized();
      }
    });
  }

  /**
   * Handle start action (opens popup for task input)
   */
  private handleStartAction(): void {
    if (this.currentStatus?.state === 'PAUSED') {
      this.sendMessage('RESUME_TIMER');
    } else {
      // Open popup for task input
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP_FOR_START' });
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
  private async requestTimerStatus(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATUS' });
      if (response.status) {
        this.updateStatus(response.status);
      }
    } catch (error) {
      logger.log('Error requesting timer status:', error);
    }
  }

  /**
   * Toggle widget minimized state
   */
  private toggleMinimized(): void {
    this.settings.minimized = !this.settings.minimized;
    this.saveSettings();
    
    // Recreate widget with new size
    this.createWidget();
    this.show();
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
      this.widget.style.display = 'block';
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
   * Cleanup widget
   */
  destroy(): void {
    this.removeWidget();
  }
}