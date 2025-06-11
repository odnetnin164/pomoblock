import { PomodoroSettings } from '@shared/pomodoroTypes';
import { StatusMessage } from '@shared/types';
import { DEFAULT_FLOATING_TIMER_SETTINGS, POMODORO_STORAGE_KEYS } from '@shared/constants';

export class PomodoroSettingsManager {
  private onStatusMessage?: (message: StatusMessage) => void;
  
  // DOM Elements
  private workDurationMinutes!: HTMLInputElement;
  private workDurationSeconds!: HTMLInputElement;
  private restDurationMinutes!: HTMLInputElement;
  private restDurationSeconds!: HTMLInputElement;
  private longRestDurationMinutes!: HTMLInputElement;
  private longRestDurationSeconds!: HTMLInputElement;
  private longRestIntervalInput!: HTMLInputElement;
  private autoStartRestToggle!: HTMLInputElement;
  private autoStartWorkToggle!: HTMLInputElement;
  private notificationsToggle!: HTMLInputElement;
  private soundToggle!: HTMLInputElement;
  
  // Floating timer elements
  private floatingTimerToggle!: HTMLInputElement;
  private floatingTimerLabel!: HTMLElement;
  
  // Labels
  private autoStartRestLabel!: HTMLElement;
  private autoStartWorkLabel!: HTMLElement;
  private notificationsLabel!: HTMLElement;
  private soundLabel!: HTMLElement;

  constructor(onStatusMessage?: (message: StatusMessage) => void) {
    this.onStatusMessage = onStatusMessage;
  }

  /**
   * Initialize the pomodoro settings UI
   */
  initializeUI(): void {
    this.createPomodoroSettingsHTML();
    this.initializeDOMElements();
    this.setupEventListeners();
    this.loadAndDisplaySettings();
  }

  /**
   * Create the HTML for pomodoro settings
   */
  private createPomodoroSettingsHTML(): void {
    const settingsContainer = document.querySelector('.container');
    if (!settingsContainer) return;

    const pomodoroSection = document.createElement('div');
    pomodoroSection.className = 'settings-section';
    pomodoroSection.innerHTML = `
      <div class="setting-group">
        <h3>🍅 Pomodoro Timer</h3>
        <p class="setting-description">Configure your pomodoro timer settings for optimal productivity</p>
        
        <div class="pomodoro-settings">
          <div class="floating-timer-settings">
            <h4>Floating Timer Widget</h4>
            <p class="subsetting-description">Control the always-visible timer widget on all web pages</p>
            <div class="floating-timer-controls">
              <div class="toggle-group">
                <label class="toggle-switch">
                  <input type="checkbox" id="showFloatingTimer">
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" id="floatingTimerLabel">Always show floating timer</span>
                <small class="toggle-description">Display a draggable timer widget on all websites</small>
              </div>
              
              <div class="floating-timer-info">
                <h5>💡 Floating Timer Features</h5>
                <ul>
                  <li><strong>Always Visible:</strong> Timer stays on screen while browsing</li>
                  <li><strong>Draggable:</strong> Move it anywhere on the screen</li>
                  <li><strong>Minimizable:</strong> Collapse to a small circle when needed</li>
                  <li><strong>Quick Controls:</strong> Start, pause, and stop without opening popup</li>
                  <li><strong>Auto-show:</strong> Appears automatically when timer is running</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="duration-settings">
            <h4>Timer Durations</h4>
            <div class="duration-controls">
              <div class="duration-input-group">
                <label for="workDuration">Work Duration:</label>
                <div class="time-input-pair">
                  <input type="number" id="workDurationMinutes" min="0" max="120" value="25" class="minutes-input">
                  <span class="time-separator">:</span>
                  <input type="number" id="workDurationSeconds" min="0" max="59" value="0" class="seconds-input">
                </div>
                <span class="duration-unit">mm:ss</span>
              </div>
              
              <div class="duration-input-group">
                <label for="restDuration">Short Break:</label>
                <div class="time-input-pair">
                  <input type="number" id="restDurationMinutes" min="0" max="60" value="5" class="minutes-input">
                  <span class="time-separator">:</span>
                  <input type="number" id="restDurationSeconds" min="0" max="59" value="0" class="seconds-input">
                </div>
                <span class="duration-unit">mm:ss</span>
              </div>
              
              <div class="duration-input-group">
                <label for="longRestDuration">Long Break:</label>
                <div class="time-input-pair">
                  <input type="number" id="longRestDurationMinutes" min="0" max="120" value="15" class="minutes-input">
                  <span class="time-separator">:</span>
                  <input type="number" id="longRestDurationSeconds" min="0" max="59" value="0" class="seconds-input">
                </div>
                <span class="duration-unit">mm:ss</span>
              </div>
              
              <div class="duration-input-group">
                <label for="longRestInterval">Long Break Every:</label>
                <input type="number" id="longRestInterval" min="2" max="10" value="4">
                <span class="duration-unit">sessions</span>
              </div>
            </div>
            
            <div class="duration-presets">
              <p>Common configurations:</p>
              <div class="preset-buttons">
                <button class="pomodoro-preset-btn" data-work="25" data-rest="5" data-long="15" data-interval="4">
                  Classic (25:00/5:00/15:00)
                </button>
                <button class="pomodoro-preset-btn" data-work="45" data-rest="15" data-long="30" data-interval="3">
                  Extended (45:00/15:00/30:00)
                </button>
                <button class="pomodoro-preset-btn" data-work="50" data-rest="10" data-long="20" data-interval="4">
                  Ultradian (50:00/10:00/20:00)
                </button>
                <button class="pomodoro-preset-btn" data-work="15" data-rest="5" data-long="15" data-interval="3">
                  Short (15:00/5:00/15:00)
                </button>
              </div>
            </div>
          </div>
          
          <div class="behavior-settings">
            <h4>Timer Behavior</h4>
            <div class="behavior-controls">
              <div class="toggle-group">
                <label class="toggle-switch">
                  <input type="checkbox" id="autoStartRest">
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" id="autoStartRestLabel">Auto-start breaks</span>
                <small class="toggle-description">Automatically start break timer when work session ends</small>
              </div>
              
              <div class="toggle-group">
                <label class="toggle-switch">
                  <input type="checkbox" id="autoStartWork">
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" id="autoStartWorkLabel">Auto-start work sessions</span>
                <small class="toggle-description">Automatically start work timer when break ends (requires task input)</small>
              </div>
            </div>
          </div>
          
          <div class="notification-settings">
            <h4>Notifications</h4>
            <div class="notification-controls">
              <div class="toggle-group">
                <label class="toggle-switch">
                  <input type="checkbox" id="showNotifications">
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" id="notificationsLabel">Browser notifications</span>
                <small class="toggle-description">Show browser notifications when timers complete</small>
              </div>
              
              <div class="toggle-group">
                <label class="toggle-switch">
                  <input type="checkbox" id="playSound">
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" id="soundLabel">Notification sound</span>
                <small class="toggle-description">Play sound when timers complete</small>
              </div>
            </div>
          </div>
          
          <div class="pomodoro-info">
            <h4>💡 Pomodoro Technique Tips</h4>
            <ul>
              <li><strong>Work Sessions:</strong> Focus on a single task during work periods</li>
              <li><strong>Short Breaks:</strong> Step away from your workspace, stretch, or hydrate</li>
              <li><strong>Long Breaks:</strong> Take a proper break - go for a walk, eat, or relax</li>
              <li><strong>Consistency:</strong> Complete the full timer duration for maximum benefit</li>
              <li><strong>Task Planning:</strong> Write clear, specific tasks before starting</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    // Insert before the existing settings sections
    const firstSection = settingsContainer.querySelector('.settings-section');
    if (firstSection) {
      settingsContainer.insertBefore(pomodoroSection, firstSection);
    } else {
      settingsContainer.appendChild(pomodoroSection);
    }
  }

  /**
   * Initialize DOM element references
   */
  private initializeDOMElements(): void {
    this.workDurationMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
    this.workDurationSeconds = document.getElementById('workDurationSeconds') as HTMLInputElement;
    this.restDurationMinutes = document.getElementById('restDurationMinutes') as HTMLInputElement;
    this.restDurationSeconds = document.getElementById('restDurationSeconds') as HTMLInputElement;
    this.longRestDurationMinutes = document.getElementById('longRestDurationMinutes') as HTMLInputElement;
    this.longRestDurationSeconds = document.getElementById('longRestDurationSeconds') as HTMLInputElement;
    this.longRestIntervalInput = document.getElementById('longRestInterval') as HTMLInputElement;
    this.autoStartRestToggle = document.getElementById('autoStartRest') as HTMLInputElement;
    this.autoStartWorkToggle = document.getElementById('autoStartWork') as HTMLInputElement;
    this.notificationsToggle = document.getElementById('showNotifications') as HTMLInputElement;
    this.soundToggle = document.getElementById('playSound') as HTMLInputElement;
    
    this.autoStartRestLabel = document.getElementById('autoStartRestLabel')!;
    this.autoStartWorkLabel = document.getElementById('autoStartWorkLabel')!;
    this.notificationsLabel = document.getElementById('notificationsLabel')!;
    this.soundLabel = document.getElementById('soundLabel')!;

    // Floating timer elements
    this.floatingTimerToggle = document.getElementById('showFloatingTimer') as HTMLInputElement;
    this.floatingTimerLabel = document.getElementById('floatingTimerLabel')!;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Toggle change listeners
    this.autoStartRestToggle.addEventListener('change', () => this.updateToggleLabels());
    this.autoStartWorkToggle.addEventListener('change', () => this.updateToggleLabels());
    this.notificationsToggle.addEventListener('change', () => this.updateToggleLabels());
    this.soundToggle.addEventListener('change', () => this.updateToggleLabels());
    this.floatingTimerToggle.addEventListener('change', () => {
      this.updateToggleLabels();
      this.updateFloatingTimerSetting();
    });

    // Preset button listeners
    const presetButtons = document.querySelectorAll('.pomodoro-preset-btn');
    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const work = button.getAttribute('data-work');
        const rest = button.getAttribute('data-rest');
        const longRest = button.getAttribute('data-long');
        const interval = button.getAttribute('data-interval');
        
        if (work && rest && longRest && interval) {
          this.workDurationMinutes.value = work;
          this.workDurationSeconds.value = '0';
          this.restDurationMinutes.value = rest;
          this.restDurationSeconds.value = '0';
          this.longRestDurationMinutes.value = longRest;
          this.longRestDurationSeconds.value = '0';
          this.longRestIntervalInput.value = interval;
          
          this.updatePresetButtons();
          this.showStatusMessage({
            text: 'Preset applied! Remember to save settings.',
            type: 'success'
          });
        }
      });
    });

    // Input change listeners for preset highlighting
    [this.workDurationMinutes, this.workDurationSeconds, this.restDurationMinutes, this.restDurationSeconds, 
     this.longRestDurationMinutes, this.longRestDurationSeconds, this.longRestIntervalInput].forEach(input => {
      input.addEventListener('input', () => this.updatePresetButtons());
    });
  }

  /**
   * Load and display current settings
   */
  private async loadAndDisplaySettings(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_POMODORO_SETTINGS' });
      if (response.settings) {
        this.displaySettings(response.settings);
      }
      
      // Load floating timer settings separately
      await this.loadFloatingTimerSettings();
    } catch (error) {
      console.error('Error loading pomodoro settings:', error);
      this.showStatusMessage({
        text: 'Error loading pomodoro settings',
        type: 'error'
      });
    }
  }

  /**
   * Load floating timer settings
   */
  private async loadFloatingTimerSettings(): Promise<void> {
    try {
      const data = await chrome.storage.local.get([POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]);
      const settings = data[POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS] || DEFAULT_FLOATING_TIMER_SETTINGS;
      this.floatingTimerToggle.checked = settings.alwaysShow;
      this.updateToggleLabels();
    } catch (error) {
      console.error('Error loading floating timer settings:', error);
    }
  }

  /**
   * Display settings in UI
   */
  private displaySettings(settings: PomodoroSettings): void {
    // Convert decimal minutes back to minutes and seconds
    const workTotalSeconds = Math.round(settings.workDuration * 60);
    const restTotalSeconds = Math.round(settings.restDuration * 60);
    const longRestTotalSeconds = Math.round(settings.longRestDuration * 60);
    
    this.workDurationMinutes.value = Math.floor(workTotalSeconds / 60).toString();
    this.workDurationSeconds.value = (workTotalSeconds % 60).toString();
    this.restDurationMinutes.value = Math.floor(restTotalSeconds / 60).toString();
    this.restDurationSeconds.value = (restTotalSeconds % 60).toString();
    this.longRestDurationMinutes.value = Math.floor(longRestTotalSeconds / 60).toString();
    this.longRestDurationSeconds.value = (longRestTotalSeconds % 60).toString();
    this.longRestIntervalInput.value = settings.longRestInterval.toString();
    this.autoStartRestToggle.checked = settings.autoStartRest;
    this.autoStartWorkToggle.checked = settings.autoStartWork;
    this.notificationsToggle.checked = settings.showNotifications;
    this.soundToggle.checked = settings.playSound;
    
    this.updateToggleLabels();
    this.updatePresetButtons();
  }

  /**
   * Get current settings from UI
   */
  getCurrentSettings(): PomodoroSettings {
    // Convert minutes:seconds to total minutes (with decimal precision)
    const workMinutes = parseInt(this.workDurationMinutes.value) || 0;
    const workSeconds = parseInt(this.workDurationSeconds.value) || 0;
    const restMinutes = parseInt(this.restDurationMinutes.value) || 0;
    const restSeconds = parseInt(this.restDurationSeconds.value) || 0;
    const longRestMinutes = parseInt(this.longRestDurationMinutes.value) || 0;
    const longRestSeconds = parseInt(this.longRestDurationSeconds.value) || 0;

    return {
      workDuration: workMinutes + (workSeconds / 60),
      restDuration: restMinutes + (restSeconds / 60),
      longRestDuration: longRestMinutes + (longRestSeconds / 60),
      longRestInterval: parseInt(this.longRestIntervalInput.value) || 4,
      autoStartRest: this.autoStartRestToggle.checked,
      autoStartWork: this.autoStartWorkToggle.checked,
      showNotifications: this.notificationsToggle.checked,
      playSound: this.soundToggle.checked
    };
  }

  /**
   * Save current settings
   */
  async saveSettings(): Promise<boolean> {
    const settings = this.getCurrentSettings();
    
    // Validate settings
    const validationError = this.validateSettings(settings);
    if (validationError) {
      this.showStatusMessage({
        text: validationError,
        type: 'error'
      });
      return false;
    }

    try {
      await chrome.runtime.sendMessage({ 
        type: 'UPDATE_POMODORO_SETTINGS', 
        settings 
      });
      
      this.showStatusMessage({
        text: 'Pomodoro settings saved successfully!',
        type: 'success'
      });
      return true;
    } catch (error) {
      console.error('Error saving pomodoro settings:', error);
      this.showStatusMessage({
        text: 'Error saving pomodoro settings',
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Validate settings
   */
  private validateSettings(settings: PomodoroSettings): string | null {
    // Convert to total seconds for validation (allowing sub-minute durations)
    const workSeconds = Math.round(settings.workDuration * 60);
    const restSeconds = Math.round(settings.restDuration * 60);
    const longRestSeconds = Math.round(settings.longRestDuration * 60);
    
    if (workSeconds < 1 || workSeconds > 120 * 60) {
      return 'Work duration must be between 1 second and 120 minutes';
    }
    
    if (restSeconds < 1 || restSeconds > 60 * 60) {
      return 'Rest duration must be between 1 second and 60 minutes';
    }
    
    if (longRestSeconds < 1 || longRestSeconds > 120 * 60) {
      return 'Long rest duration must be between 1 second and 120 minutes';
    }
    
    if (settings.longRestInterval < 2 || settings.longRestInterval > 10) {
      return 'Long rest interval must be between 2 and 10 sessions';
    }
    
    return null;
  }

  /**
   * Update toggle labels
   */
  private updateToggleLabels(): void {
    this.autoStartRestLabel.textContent = this.autoStartRestToggle.checked ? 
      'Auto-start breaks enabled' : 'Auto-start breaks disabled';
    
    this.autoStartWorkLabel.textContent = this.autoStartWorkToggle.checked ? 
      'Auto-start work enabled' : 'Auto-start work disabled';
    
    this.notificationsLabel.textContent = this.notificationsToggle.checked ? 
      'Notifications enabled' : 'Notifications disabled';
    
    this.soundLabel.textContent = this.soundToggle.checked ? 
      'Sound enabled' : 'Sound disabled';
      
    this.floatingTimerLabel.textContent = this.floatingTimerToggle.checked ? 
      'Always show floating timer' : 'Show floating timer when active';
  }

  /**
   * Update floating timer setting immediately
   */
  private async updateFloatingTimerSetting(): Promise<void> {
    try {
      const settings = {
        ...DEFAULT_FLOATING_TIMER_SETTINGS,
        alwaysShow: this.floatingTimerToggle.checked
      };
      
      await chrome.storage.local.set({ [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: settings });
      
      // Notify all content scripts about the change
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_FLOATING_TIMER',
            alwaysShow: this.floatingTimerToggle.checked
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      });
      
      this.showStatusMessage({
        text: `Floating timer ${this.floatingTimerToggle.checked ? 'enabled' : 'disabled'}!`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating floating timer setting:', error);
      this.showStatusMessage({
        text: 'Error updating floating timer setting',
        type: 'error'
      });
    }
  }

  /**
   * Update preset button active states
   */
  private updatePresetButtons(): void {
    const currentWork = parseInt(this.workDurationMinutes.value) || 0;
    const currentWorkSeconds = parseInt(this.workDurationSeconds.value) || 0;
    const currentRest = parseInt(this.restDurationMinutes.value) || 0;
    const currentRestSeconds = parseInt(this.restDurationSeconds.value) || 0;
    const currentLongRest = parseInt(this.longRestDurationMinutes.value) || 0;
    const currentLongRestSeconds = parseInt(this.longRestDurationSeconds.value) || 0;
    const currentInterval = parseInt(this.longRestIntervalInput.value);
    
    const presetButtons = document.querySelectorAll('.pomodoro-preset-btn');
    presetButtons.forEach(button => {
      const presetWork = parseInt(button.getAttribute('data-work') || '0');
      const presetRest = parseInt(button.getAttribute('data-rest') || '0');
      const presetLongRest = parseInt(button.getAttribute('data-long') || '0');
      const presetInterval = parseInt(button.getAttribute('data-interval') || '0');
      
      // Check if current values match preset (preset values are in minutes, seconds should be 0)
      if (currentWork === presetWork && currentWorkSeconds === 0 &&
          currentRest === presetRest && currentRestSeconds === 0 &&
          currentLongRest === presetLongRest && currentLongRestSeconds === 0 &&
          currentInterval === presetInterval) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Show status message
   */
  private showStatusMessage(message: StatusMessage): void {
    if (this.onStatusMessage) {
      this.onStatusMessage(message);
    }
  }
}