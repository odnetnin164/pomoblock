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
  
  // Audio elements
  private audioEnabledToggle!: HTMLInputElement;
  private audioVolumeSlider!: HTMLInputElement;
  private soundThemeSelect!: HTMLSelectElement;
  private workCompleteSoundSelect!: HTMLSelectElement;
  private restCompleteSoundSelect!: HTMLSelectElement;
  private sessionStartSoundSelect!: HTMLSelectElement;
  private customSoundUpload!: HTMLInputElement;
  
  // Floating timer elements
  private floatingTimerToggle!: HTMLInputElement;
  private floatingTimerLabel!: HTMLElement;
  
  // Labels
  private autoStartRestLabel!: HTMLElement;
  private autoStartWorkLabel!: HTMLElement;
  private notificationsLabel!: HTMLElement;
  private soundLabel!: HTMLElement;
  private audioEnabledLabel!: HTMLElement;
  private volumeValue!: HTMLElement;

  constructor(onStatusMessage?: (message: StatusMessage) => void) {
    this.onStatusMessage = onStatusMessage;
  }

  /**
   * Initialize the pomodoro settings UI
   */
  async initializeUI(): Promise<void> {
    this.createPomodoroSettingsHTML();
    this.initializeDOMElements();
    this.setupEventListeners();
    await this.loadAndDisplaySettings();
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
                <input type="number" class="smallOptionsInput" id="longRestInterval" min="2" max="10" value="4">
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
                <span class="toggle-label" id="soundLabel">Basic notification sound</span>
                <small class="toggle-description">Simple browser notification sound (legacy)</small>
              </div>
            </div>
          </div>
          
          <div class="audio-settings">
            <h4>🔊 Custom Audio Settings</h4>
            <div class="audio-controls">
              <div class="toggle-group">
                <label class="toggle-switch">
                  <input type="checkbox" id="audioEnabled">
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" id="audioEnabledLabel">Enhanced audio notifications</span>
                <small class="toggle-description">Use custom sounds for different timer events</small>
              </div>
              
              <div class="audio-options" id="audioOptions">
                <div class="volume-control">
                  <label for="audioVolume">Volume:</label>
                  <input type="range" id="audioVolume" min="0" max="100" value="70" class="volume-slider">
                  <span class="volume-value" id="volumeValue">70%</span>
                </div>
                
                <div class="sound-theme-control">
                  <label for="soundTheme">Sound Theme:</label>
                  <select id="soundTheme" class="sound-theme-select">
                    <option value="default">Default</option>
                    <option value="nature">Nature</option>
                    <option value="minimal">Minimal</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                
                <div class="individual-sounds">
                  <h5>Individual Sound Settings:</h5>
                  
                  <div class="sound-setting">
                    <label for="workCompleteSound">Work Complete:</label>
                    <select id="workCompleteSound" class="sound-select">
                      <option value="chime">Chime</option>
                      <option value="bell">Bell</option>
                      <option value="ding">Ding</option>
                      <option value="notification">Notification</option>
                    </select>
                    <button class="test-sound-btn" data-sound="workComplete">🔊 Test</button>
                  </div>
                  
                  <div class="sound-setting">
                    <label for="restCompleteSound">Break Complete:</label>
                    <select id="restCompleteSound" class="sound-select">
                      <option value="bell">Bell</option>
                      <option value="chime">Chime</option>
                      <option value="ding">Ding</option>
                      <option value="notification">Notification</option>
                    </select>
                    <button class="test-sound-btn" data-sound="restComplete">🔊 Test</button>
                  </div>
                  
                  <div class="sound-setting">
                    <label for="sessionStartSound">Session Start:</label>
                    <select id="sessionStartSound" class="sound-select">
                      <option value="ding">Ding</option>
                      <option value="chime">Chime</option>
                      <option value="bell">Bell</option>
                      <option value="notification">Notification</option>
                    </select>
                    <button class="test-sound-btn" data-sound="sessionStart">🔊 Test</button>
                  </div>
                </div>
                
                <div class="custom-sounds-section" id="customSoundsSection" style="display: none;">
                  <h5>Custom Sounds:</h5>
                  <div class="custom-sound-upload">
                    <input type="file" id="customSoundUpload" accept="audio/*" multiple style="display: none;">
                    <button class="upload-sound-btn" onclick="document.getElementById('customSoundUpload').click()">📁 Upload Custom Sounds</button>
                    <small class="upload-description">Upload .mp3, .wav, or .ogg files (max 1MB each)</small>
                  </div>
                  <div class="custom-sounds-list" id="customSoundsList"></div>
                </div>
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

    // Audio elements
    this.audioEnabledToggle = document.getElementById('audioEnabled') as HTMLInputElement;
    this.audioVolumeSlider = document.getElementById('audioVolume') as HTMLInputElement;
    this.soundThemeSelect = document.getElementById('soundTheme') as HTMLSelectElement;
    this.workCompleteSoundSelect = document.getElementById('workCompleteSound') as HTMLSelectElement;
    this.restCompleteSoundSelect = document.getElementById('restCompleteSound') as HTMLSelectElement;
    this.sessionStartSoundSelect = document.getElementById('sessionStartSound') as HTMLSelectElement;
    this.customSoundUpload = document.getElementById('customSoundUpload') as HTMLInputElement;
    this.audioEnabledLabel = document.getElementById('audioEnabledLabel')!;
    this.volumeValue = document.getElementById('volumeValue')!;

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

    // Audio event listeners
    this.audioEnabledToggle.addEventListener('change', () => {
      this.updateToggleLabels();
      this.toggleAudioOptions();
    });
    this.audioVolumeSlider.addEventListener('input', () => this.updateVolumeDisplay());
    this.soundThemeSelect.addEventListener('change', () => {
      this.updateSoundTheme().catch(error => {
        console.error('Error updating sound theme:', error);
      });
    });
    this.customSoundUpload.addEventListener('change', (e) => this.handleCustomSoundUpload(e));

    // Test sound button listeners
    document.querySelectorAll('.test-sound-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const soundType = (e.target as HTMLElement).dataset.sound;
        if (soundType) this.testSound(soundType);
      });
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
        await this.displaySettings(response.settings);
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
  private async displaySettings(settings: PomodoroSettings): Promise<void> {
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
    
    // Load audio settings
    this.audioEnabledToggle.checked = settings.audioEnabled || false;
    this.audioVolumeSlider.value = (settings.audioVolume || 70).toString();
    this.soundThemeSelect.value = settings.soundTheme || 'default';
    this.workCompleteSoundSelect.value = settings.workCompleteSound || 'chime';
    this.restCompleteSoundSelect.value = settings.restCompleteSound || 'bell';
    this.sessionStartSoundSelect.value = settings.sessionStartSound || 'ding';
    
    this.updateToggleLabels();
    this.updatePresetButtons();
    this.updateVolumeDisplay();
    this.toggleAudioOptions();
    await this.updateSoundTheme();
    await this.refreshCustomSoundsList();
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
      playSound: this.soundToggle.checked,
      // Audio settings
      audioEnabled: this.audioEnabledToggle.checked,
      audioVolume: parseInt(this.audioVolumeSlider.value) || 70,
      soundTheme: (this.soundThemeSelect.value as 'default' | 'nature' | 'minimal' | 'custom') || 'default',
      workCompleteSound: this.workCompleteSoundSelect.value || 'chime',
      restCompleteSound: this.restCompleteSoundSelect.value || 'bell',
      sessionStartSound: this.sessionStartSoundSelect.value || 'ding'
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
      
    this.audioEnabledLabel.textContent = this.audioEnabledToggle.checked ? 
      'Enhanced audio enabled' : 'Enhanced audio disabled';
      
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
   * Toggle audio options visibility
   */
  private toggleAudioOptions(): void {
    const audioOptions = document.getElementById('audioOptions');
    const customSoundsSection = document.getElementById('customSoundsSection');
    
    if (audioOptions) {
      audioOptions.style.display = this.audioEnabledToggle.checked ? 'block' : 'none';
    }
    
    if (customSoundsSection && this.soundThemeSelect.value === 'custom') {
      customSoundsSection.style.display = this.audioEnabledToggle.checked ? 'block' : 'none';
    }
  }

  /**
   * Update volume display
   */
  private updateVolumeDisplay(): void {
    if (this.volumeValue) {
      this.volumeValue.textContent = `${this.audioVolumeSlider.value}%`;
    }
  }

  /**
   * Update sound theme and show/hide custom sounds section
   */
  private async updateSoundTheme(): Promise<void> {
    const customSoundsSection = document.getElementById('customSoundsSection');
    const isCustomTheme = this.soundThemeSelect.value === 'custom';
    const isAudioEnabled = this.audioEnabledToggle.checked;
    
    if (customSoundsSection) {
      customSoundsSection.style.display = (isCustomTheme && isAudioEnabled) ? 'block' : 'none';
    }

    // Update sound options based on theme
    if (this.soundThemeSelect.value !== 'custom') {
      await this.applyThemeToSoundSelects();
    } else {
      // For custom theme, just update the options
      await this.updateSoundSelectOptions();
    }
  }

  /**
   * Apply sound theme to individual sound selects
   */
  private async applyThemeToSoundSelects(): Promise<void> {
    const themes = {
      default: {
        workComplete: 'chime',
        restComplete: 'bell',
        sessionStart: 'ding'
      },
      nature: {
        workComplete: 'nature_birds',
        restComplete: 'nature_water',
        sessionStart: 'nature_wind'
      },
      minimal: {
        workComplete: 'minimal_pop',
        restComplete: 'minimal_beep',
        sessionStart: 'minimal_click'
      }
    };

    const themeValue = this.soundThemeSelect.value as 'default' | 'nature' | 'minimal' | 'custom';
    const theme = themes[themeValue as keyof typeof themes];
    
    if (theme) {
      // Update the options in the select elements
      await this.updateSoundSelectOptions();
      
      // Set the values
      this.workCompleteSoundSelect.value = theme.workComplete;
      this.restCompleteSoundSelect.value = theme.restComplete;
      this.sessionStartSoundSelect.value = theme.sessionStart;
    } else if (themeValue === 'custom') {
      // For custom theme, just update the options, don't set specific values
      await this.updateSoundSelectOptions();
    }
  }

  /**
   * Update sound select options based on theme
   */
  private async updateSoundSelectOptions(): Promise<void> {
    const soundOptions = {
      default: [
        { value: 'chime', text: 'Chime' },
        { value: 'bell', text: 'Bell' },
        { value: 'ding', text: 'Ding' },
        { value: 'notification', text: 'Notification' }
      ],
      nature: [
        { value: 'nature_birds', text: 'Birds' },
        { value: 'nature_water', text: 'Water' },
        { value: 'nature_wind', text: 'Wind' }
      ],
      minimal: [
        { value: 'minimal_click', text: 'Click' },
        { value: 'minimal_pop', text: 'Pop' },
        { value: 'minimal_beep', text: 'Beep' }
      ]
    };

    const theme = this.soundThemeSelect.value as 'default' | 'nature' | 'minimal' | 'custom';
    let options = soundOptions[theme as keyof typeof soundOptions] || soundOptions.default;

    // If custom theme is selected, get custom sounds from storage
    if (theme === 'custom') {
      const customSounds = await this.getCustomSounds();
      options = Object.entries(customSounds).map(([soundId, soundData]: [string, any]) => ({
        value: soundId,
        text: soundData.name
      }));
      
      // If no custom sounds available, show a message
      if (options.length === 0) {
        options = [{ value: '', text: 'No custom sounds available - upload some first!' }];
      }
    }

    [this.workCompleteSoundSelect, this.restCompleteSoundSelect, this.sessionStartSoundSelect].forEach(select => {
      const currentValue = select.value;
      select.innerHTML = '';
      
      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        optionElement.disabled = option.value === ''; // Disable placeholder options
        select.appendChild(optionElement);
      });
      
      // Try to restore previous value, or use first option
      if (options.some(opt => opt.value === currentValue && opt.value !== '')) {
        select.value = currentValue;
      } else if (options.length > 0 && options[0].value !== '') {
        select.selectedIndex = 0;
      }
    });
  }

  /**
   * Test a sound
   */
  private async testSound(soundType: string): Promise<void> {
    try {
      let soundId = '';
      
      switch (soundType) {
        case 'workComplete':
          soundId = this.workCompleteSoundSelect.value;
          break;
        case 'restComplete':
          soundId = this.restCompleteSoundSelect.value;
          break;
        case 'sessionStart':
          soundId = this.sessionStartSoundSelect.value;
          break;
      }

      if (soundId) {
        // Send message to content script or background to play the sound
        await chrome.runtime.sendMessage({
          type: 'TEST_SOUND',
          data: {
            soundId: soundId,
            volume: parseInt(this.audioVolumeSlider.value)
          }
        });
      }
    } catch (error) {
      console.error('Error testing sound:', error);
      this.showStatusMessage({
        text: 'Error testing sound',
        type: 'error'
      });
    }
  }

  /**
   * Handle custom sound file upload
   */
  private async handleCustomSoundUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) return;

    try {
      for (const file of Array.from(files)) {
        // Validate file
        if (!file.type.startsWith('audio/')) {
          this.showStatusMessage({
            text: `${file.name} is not an audio file`,
            type: 'error'
          });
          continue;
        }

        if (file.size > 1024 * 1024) { // 1MB limit
          this.showStatusMessage({
            text: `${file.name} is too large (max 1MB)`,
            type: 'error'
          });
          continue;
        }

        // Convert to data URL
        const dataUrl = await this.fileToDataUrl(file);
        
        // Store custom sound
        await this.storeCustomSound(file.name, dataUrl);
        
        this.showStatusMessage({
          text: `${file.name} uploaded successfully`,
          type: 'success'
        });
      }
      
      // Refresh custom sounds list
      this.refreshCustomSoundsList();
      
    } catch (error) {
      console.error('Error uploading custom sound:', error);
      this.showStatusMessage({
        text: 'Error uploading custom sound',
        type: 'error'
      });
    }
  }

  /**
   * Convert file to data URL
   */
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Store custom sound in Chrome storage
   */
  private async storeCustomSound(name: string, dataUrl: string): Promise<void> {
    const customSounds = await this.getCustomSounds();
    const soundId = `custom_${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    customSounds[soundId] = {
      name: name,
      dataUrl: dataUrl,
      uploadDate: new Date().toISOString()
    };

    await chrome.storage.local.set({ customSounds });
  }

  /**
   * Get custom sounds from storage
   */
  private async getCustomSounds(): Promise<Record<string, any>> {
    const result = await chrome.storage.local.get('customSounds');
    return result.customSounds || {};
  }

  /**
   * Refresh custom sounds list UI
   */
  private async refreshCustomSoundsList(): Promise<void> {
    const customSoundsList = document.getElementById('customSoundsList');
    if (!customSoundsList) return;

    const customSounds = await this.getCustomSounds();
    
    customSoundsList.innerHTML = '';
    
    Object.entries(customSounds).forEach(([soundId, soundData]: [string, any]) => {
      const soundItem = document.createElement('div');
      soundItem.className = 'custom-sound-item';
      soundItem.innerHTML = `
        <span class="sound-name">${soundData.name}</span>
        <button class="test-custom-sound-btn" data-sound-id="${soundId}">🔊 Test</button>
        <button class="delete-custom-sound-btn" data-sound-id="${soundId}">🗑 Delete</button>
      `;
      
      // Add event listeners
      soundItem.querySelector('.test-custom-sound-btn')?.addEventListener('click', () => {
        this.testCustomSound(soundId, soundData.dataUrl);
      });
      
      soundItem.querySelector('.delete-custom-sound-btn')?.addEventListener('click', () => {
        this.deleteCustomSound(soundId);
      });
      
      customSoundsList.appendChild(soundItem);
    });
  }

  /**
   * Test custom sound
   */
  private async testCustomSound(soundId: string, dataUrl: string): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'TEST_CUSTOM_SOUND',
        data: {
          soundId: soundId,
          dataUrl: dataUrl,
          volume: parseInt(this.audioVolumeSlider.value)
        }
      });
    } catch (error) {
      console.error('Error testing custom sound:', error);
    }
  }

  /**
   * Delete custom sound
   */
  private async deleteCustomSound(soundId: string): Promise<void> {
    try {
      const customSounds = await this.getCustomSounds();
      delete customSounds[soundId];
      await chrome.storage.local.set({ customSounds });
      
      this.refreshCustomSoundsList();
      this.showStatusMessage({
        text: 'Custom sound deleted',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting custom sound:', error);
      this.showStatusMessage({
        text: 'Error deleting custom sound',
        type: 'error'
      });
    }
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