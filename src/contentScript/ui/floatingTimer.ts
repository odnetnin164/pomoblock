// src/contentScript/ui/floatingTimer.ts
import { TimerStatus, TimerState } from '@shared/pomodoroTypes';
import { formatDuration } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';
import { DEFAULT_FLOATING_TIMER_SETTINGS, POMODORO_STORAGE_KEYS } from '@shared/constants';
import { PomodoroTimer } from '@shared/pomodoroTimer';

export class FloatingTimer {
  private widget: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  // For testing access to closed shadow DOM
  private _testShadowRoot: ShadowRoot | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private currentStatus: TimerStatus | null = null;
  private isVisible = false;
  private settings = { ...DEFAULT_FLOATING_TIMER_SETTINGS };
  private helperTimer: PomodoroTimer;

  constructor() {
    // Create helper timer instance for UI logic (no callbacks needed)
    this.helperTimer = new PomodoroTimer();
    this.setupRuntimeListeners();
    this.setupTabChangeHandling();
    this.setupBlockedPageEventListeners();
    // Load settings and create widget after settings are loaded
    this.initializeWidget();
  }

  /**
   * Load CSS content for Shadow DOM
   */
  private async loadCSS(): Promise<string> {
    try {
      const cssUrl = chrome.runtime.getURL('shared/floating-timer.css');
      const response = await fetch(cssUrl);
      return await response.text();
    } catch (error) {
      logger.log('Error loading floating timer CSS:', error);
      return '';
    }
  }

  /**
   * Initialize widget with proper settings loading
   */
  private async initializeWidget(): Promise<void> {
    await this.loadSettings();
    await this.createWidget();
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
   * Create the floating timer widget with Shadow DOM encapsulation
   */
  private async createWidget(): Promise<void> {
    // Remove existing widget if any
    this.removeWidget();

    // Load CSS content
    const cssContent = await this.loadCSS();

    // Create the host element
    this.widget = document.createElement('div');
    this.widget.id = 'pomoblock-floating-timer-host';
    this.widget.style.cssText = `
      position: fixed !important;
      top: ${this.settings.position.y}px !important;
      left: ${this.settings.position.x}px !important;
      width: 280px !important;
      height: 50px !important;
      z-index: 2147483648 !important;
      cursor: move !important;
      user-select: none !important;
      display: ${this.isVisible ? 'flex' : 'none'} !important;
      pointer-events: auto !important;
    `;

    // Create shadow root for complete CSS isolation
    this.shadowRoot = this.widget.attachShadow({ mode: 'closed' });
    // Store reference for testing
    this._testShadowRoot = this.shadowRoot;

    // Create style element with CSS
    const style = document.createElement('style');
    style.textContent = cssContent;
    this.shadowRoot.appendChild(style);

    // Create the actual timer widget
    const timerWidget = document.createElement('div');
    timerWidget.className = 'floating-timer';
    
    this.shadowRoot.appendChild(timerWidget);
    this.updateWidgetContent();
    
    document.documentElement.appendChild(this.widget);

    // Setup event listeners and drag functionality
    this.setupEventListeners();
    this.setupDragHandlers();
    
    // Ensure position is within viewport bounds after creation
    setTimeout(() => this.ensureWidgetPosition(), 100);
  }

  /**
   * Update widget content based on current timer status
   */
  private updateWidgetContent(): void {
    if (!this.shadowRoot) return;

    const timerWidget = this.shadowRoot.querySelector('.floating-timer');
    if (!timerWidget) return;

    if (!this.currentStatus || this.currentStatus.state === 'STOPPED') {
      timerWidget.innerHTML = this.getStoppedContent();
    } else {
      timerWidget.innerHTML = this.getActiveContent();
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
    `;
  }

  /**
   * Update widget styling based on timer state
   */
  private updateWidgetStyling(): void {
    if (!this.shadowRoot || !this.currentStatus) return;

    const timerWidget = this.shadowRoot.querySelector('.floating-timer') as HTMLElement;
    const progressBar = this.shadowRoot.querySelector('.timer-progress-bar') as HTMLElement;
    
    if (!timerWidget) return;

    // Remove existing state classes
    timerWidget.classList.remove('timer-work', 'timer-rest', 'timer-paused');
    
    // Add appropriate state class
    switch (this.currentStatus.state) {
      case 'WORK':
        timerWidget.classList.add('timer-work');
        if (progressBar) {
          progressBar.className = 'timer-progress-bar work';
        }
        break;
      case 'REST':
        timerWidget.classList.add('timer-rest');
        if (progressBar) {
          progressBar.className = 'timer-progress-bar rest';
        }
        break;
      case 'PAUSED':
        timerWidget.classList.add('timer-paused');
        if (progressBar) {
          progressBar.className = 'timer-progress-bar paused';
        }
        break;
      default:
        if (progressBar) {
          progressBar.className = 'timer-progress-bar stopped';
        }
        break;
    }
  }

  /**
   * Setup drag handlers for the widget
   */
  private setupDragHandlers(): void {
    if (!this.widget || !this.shadowRoot) return;

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

    // Add mousedown listener to the shadow root to capture drag events
    this.shadowRoot.addEventListener('mousedown', handleMouseDown);
  }

  /**
   * Setup event listeners for widget interactions
   */
  private setupEventListeners(): void {
    // Listen for clicks on the widget (using event delegation through shadow root)
    if (this.shadowRoot) {
      this.shadowRoot.addEventListener('click', (e) => {
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
    }
  }

  /**
   * Setup Chrome runtime message listeners
   */
  private setupRuntimeListeners(): void {
    // Listen for timer updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TIMER_UPDATE' && message.data.timerStatus) {
        this.updateStatus(message.data.timerStatus);
      } else if (message.type === 'TIMER_COMPLETE') {
        // Add vibration when session completes
        this.triggerVibration();
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
   * Trigger vibration when session completes
   */
  private triggerVibration(): void {
    // Trigger haptic vibration if supported
    if (navigator.vibrate) {
      try {
        // Vibrate for 500ms, pause 200ms, vibrate 300ms
        // This creates a distinctive pattern for session completion
        navigator.vibrate([500, 200, 300]);
        logger.log('Session completion haptic vibration triggered');
      } catch (error) {
        logger.log('Error triggering haptic vibration:', error);
      }
    } else {
      logger.log('Haptic vibration API not supported');
    }

    // Always trigger visual vibration effect
    this.triggerVisualVibration();
  }

  /**
   * Trigger visual vibration effect on the widget
   */
  private triggerVisualVibration(): void {
    if (!this.widget) {
      logger.log('No widget available for visual vibration');
      return;
    }

    try {
      // Add shake animation class
      this.widget.style.animation = 'shake 0.6s ease-in-out';
      
      // Add shake keyframes to the document if not already present
      const styleId = 'pomoblock-shake-animation';
      if (!document.getElementById(styleId)) {
        const shakeStyle = document.createElement('style');
        shakeStyle.id = styleId;
        shakeStyle.textContent = `
          @keyframes shake {
            0% { transform: translate(0, 0) rotate(0deg); }
            10% { transform: translate(-5px, -2px) rotate(-1deg); }
            20% { transform: translate(5px, 2px) rotate(1deg); }
            30% { transform: translate(-5px, 2px) rotate(0deg); }
            40% { transform: translate(5px, -2px) rotate(1deg); }
            50% { transform: translate(-2px, 5px) rotate(-1deg); }
            60% { transform: translate(2px, -5px) rotate(0deg); }
            70% { transform: translate(-5px, -2px) rotate(-1deg); }
            80% { transform: translate(5px, 2px) rotate(1deg); }
            90% { transform: translate(-2px, -2px) rotate(0deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
          }
        `;
        document.head.appendChild(shakeStyle);
      }

      // Remove animation after it completes
      setTimeout(() => {
        if (this.widget) {
          this.widget.style.animation = '';
        }
      }, 600);

      logger.log('Session completion visual vibration triggered');
    } catch (error) {
      logger.log('Error triggering visual vibration:', error);
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
    
    // Visibility is controlled by alwaysShow setting only
    if (this.settings.alwaysShow) {
      this.show();
    } else {
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
      // Recreate the cssText with the correct display value
      this.widget.style.cssText = `
        position: fixed !important;
        top: ${this.settings.position.y}px !important;
        left: ${this.settings.position.x}px !important;
        width: 280px !important;
        height: 50px !important;
        z-index: 2147483648 !important;
        cursor: move !important;
        user-select: none !important;
        display: flex !important;
        pointer-events: auto !important;
      `;
    }
  }

  /**
   * Hide the widget
   */
  hide(): void {
    this.isVisible = false;
    if (this.widget) {
      // Recreate the cssText with the correct display value
      this.widget.style.cssText = `
        position: fixed !important;
        top: ${this.settings.position.y}px !important;
        left: ${this.settings.position.x}px !important;
        width: 280px !important;
        height: 50px !important;
        z-index: 2147483648 !important;
        cursor: move !important;
        user-select: none !important;
        display: none !important;
        pointer-events: auto !important;
      `;
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
    
    // Simple logic: show if enabled, hide if disabled
    if (alwaysShow) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Remove widget from DOM
   */
  private removeWidget(): void {
    // First remove all existing widgets by ID (in case there are duplicates)
    let existingWidget;
    while ((existingWidget = document.getElementById('pomoblock-floating-timer-host'))) {
      existingWidget.remove();
    }
    
    // Clear internal reference
    if (this.widget) {
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
  private async ensureVisibilityOnBlockedPage(): Promise<void> {
    logger.log('Ensuring floating timer visibility on blocked page');
    
    if (!this.widget) {
      logger.log('Widget does not exist, creating it');
      await this.createWidget();
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