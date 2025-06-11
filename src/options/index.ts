// src/options/index.ts
import './options.css';
import { ExtensionSettings, StatusMessage, WorkHours } from '@shared/types';
import { UI_CONFIG, WORK_HOURS_CONFIG } from '@shared/constants';
import { SettingsManager } from './SettingsManager';
import { SiteListManager } from './SiteListManager';
import { PomodoroSettingsManager } from './PomodoroSettingsManager';
import { isWithinWorkHours, getWorkHoursStatus } from '@shared/workHoursUtils';
import { logger } from '@shared/logger';

class OptionsPageManager {
  private settingsManager: SettingsManager;
  private siteListManager: SiteListManager;
  private pomodoroSettingsManager: PomodoroSettingsManager;
  
  // Settings DOM Elements
  private blockModeRadio!: HTMLInputElement;
  private redirectModeRadio!: HTMLInputElement;
  private redirectSettings!: HTMLElement;
  private redirectUrl!: HTMLInputElement;
  private redirectDelay!: HTMLInputElement;
  private testRedirect!: HTMLButtonElement;
  private extensionEnabled!: HTMLInputElement;
  private debugEnabled!: HTMLInputElement;
  private saveSettings!: HTMLButtonElement;
  private resetSettings!: HTMLButtonElement;
  
  // Site Management DOM Elements
  private newSiteInput!: HTMLInputElement;
  private addSiteButton!: HTMLButtonElement;
  private blockedSitesList!: HTMLElement;
  private sitesCount!: HTMLElement;
  private clearAllSites!: HTMLButtonElement;
  
  // Whitelist DOM Elements
  private newWhitelistInput!: HTMLInputElement;
  private addWhitelistButton!: HTMLButtonElement;
  private whitelistedPathsList!: HTMLElement;
  private whitelistCount!: HTMLElement;
  private clearAllWhitelist!: HTMLButtonElement;
  
  // Work Hours DOM Elements
  private workHoursEnabled!: HTMLInputElement;
  private workHoursSettings!: HTMLElement;
  private workStartTime!: HTMLInputElement;
  private workEndTime!: HTMLInputElement;
  private workHoursStatus!: HTMLElement;
  private workHoursStatusDot!: HTMLElement;
  private workHoursStatusText!: HTMLElement;
  private workHoursToggleLabel!: HTMLElement;
  
  // UI Elements
  private statusMessage!: HTMLElement;

  constructor() {
    // Initialize managers
    this.settingsManager = new SettingsManager((msg: StatusMessage) => this.showStatusMessage(msg));
    this.siteListManager = new SiteListManager(
      (msg: StatusMessage) => this.showStatusMessage(msg),
      () => this.refreshSiteLists()
    );
    this.pomodoroSettingsManager = new PomodoroSettingsManager(
      (msg: StatusMessage) => this.showStatusMessage(msg)
    );
    
    // Get DOM elements
    this.initializeDOMElements();
    
    // Initialize the page
    this.init();
  }

  /**
   * Initialize DOM element references
   */
  private initializeDOMElements(): void {
    // Settings elements
    this.blockModeRadio = document.getElementById('blockMode') as HTMLInputElement;
    this.redirectModeRadio = document.getElementById('redirectMode') as HTMLInputElement;
    this.redirectSettings = document.getElementById('redirectSettings')!;
    this.redirectUrl = document.getElementById('redirectUrl') as HTMLInputElement;
    this.redirectDelay = document.getElementById('redirectDelay') as HTMLInputElement;
    this.testRedirect = document.getElementById('testRedirect') as HTMLButtonElement;
    this.extensionEnabled = document.getElementById('extensionEnabled') as HTMLInputElement;
    this.debugEnabled = document.getElementById('debugEnabled') as HTMLInputElement;
    this.saveSettings = document.getElementById('saveSettings') as HTMLButtonElement;
    this.resetSettings = document.getElementById('resetSettings') as HTMLButtonElement;
    
    // Site management elements
    this.newSiteInput = document.getElementById('newSiteInput') as HTMLInputElement;
    this.addSiteButton = document.getElementById('addSiteButton') as HTMLButtonElement;
    this.blockedSitesList = document.getElementById('blockedSitesList')!;
    this.sitesCount = document.getElementById('sitesCount')!;
    this.clearAllSites = document.getElementById('clearAllSites') as HTMLButtonElement;
    
    // Whitelist elements
    this.newWhitelistInput = document.getElementById('newWhitelistInput') as HTMLInputElement;
    this.addWhitelistButton = document.getElementById('addWhitelistButton') as HTMLButtonElement;
    this.whitelistedPathsList = document.getElementById('whitelistedPathsList')!;
    this.whitelistCount = document.getElementById('whitelistCount')!;
    this.clearAllWhitelist = document.getElementById('clearAllWhitelist') as HTMLButtonElement;
    
    // Work Hours elements
    this.workHoursEnabled = document.getElementById('workHoursEnabled') as HTMLInputElement;
    this.workHoursSettings = document.getElementById('workHoursSettings')!;
    this.workStartTime = document.getElementById('workStartTime') as HTMLInputElement;
    this.workEndTime = document.getElementById('workEndTime') as HTMLInputElement;
    this.workHoursStatus = document.getElementById('workHoursStatus')!;
    this.workHoursStatusDot = document.getElementById('workHoursStatusDot')!;
    this.workHoursStatusText = document.getElementById('workHoursStatusText')!;
    this.workHoursToggleLabel = document.getElementById('workHoursToggleLabel')!;
    
    // UI elements
    this.statusMessage = document.getElementById('statusMessage')!;
  }

  /**
   * Initialize the options page
   */
  private async init(): Promise<void> {
    // Initialize pomodoro settings UI first (creates HTML)
    this.pomodoroSettingsManager.initializeUI();
    
    // Load and display settings
    await this.loadAndDisplaySettings();
    
    // Load and display site lists
    await this.refreshSiteLists();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup input validation
    this.setupInputValidation();
    
    // Focus first input
    this.newSiteInput.focus();
  }

  /**
   * Load and display current settings
   */
  private async loadAndDisplaySettings(): Promise<void> {
    const settings = await this.settingsManager.loadSettings();
    this.displaySettings(settings);
  }

  /**
   * Display settings in the UI
   */
  private displaySettings(settings: ExtensionSettings): void {
    // Set radio buttons
    if (settings.blockMode === 'block') {
      this.blockModeRadio.checked = true;
    } else {
      this.redirectModeRadio.checked = true;
    }

    // Set other settings
    this.redirectUrl.value = settings.redirectUrl;
    this.redirectDelay.value = settings.redirectDelay.toString();
    this.extensionEnabled.checked = settings.extensionEnabled;
    this.debugEnabled.checked = settings.debugEnabled;

    // Set work hours settings
    this.workHoursEnabled.checked = settings.workHours.enabled;
    this.workStartTime.value = settings.workHours.startTime;
    this.workEndTime.value = settings.workHours.endTime;
    
    // Set work days checkboxes
    const workDayCheckboxes = document.querySelectorAll('.work-day') as NodeListOf<HTMLInputElement>;
    workDayCheckboxes.forEach(checkbox => {
      checkbox.checked = settings.workHours.days.includes(parseInt(checkbox.value));
    });

    // Update UI state
    this.updateRedirectVisibility();
    this.updateWorkHoursVisibility();
    this.updateToggleLabels();
    this.updatePresetButtons();
    this.updateTimePresetButtons();
    this.updateWorkHoursStatus(settings.workHours);
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Settings event listeners
    this.blockModeRadio.addEventListener('change', () => this.updateRedirectVisibility());
    this.redirectModeRadio.addEventListener('change', () => this.updateRedirectVisibility());
    this.extensionEnabled.addEventListener('change', () => this.updateToggleLabels());
    this.debugEnabled.addEventListener('change', () => this.updateToggleLabels());
    this.workHoursEnabled.addEventListener('change', () => {
      this.updateWorkHoursVisibility();
      this.updateToggleLabels();
      this.updateWorkHoursStatus();
    });
    this.workStartTime.addEventListener('change', () => this.updateWorkHoursStatus());
    this.workEndTime.addEventListener('change', () => this.updateWorkHoursStatus());
    this.saveSettings.addEventListener('click', () => this.saveCurrentSettings());
    this.resetSettings.addEventListener('click', () => this.resetToDefaults());
    this.testRedirect.addEventListener('click', () => this.testRedirectUrl());
    this.redirectDelay.addEventListener('input', () => this.updatePresetButtons());

    // Site management event listeners
    this.addSiteButton.addEventListener('click', () => this.addNewSite());
    this.newSiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addNewSite();
    });
    this.clearAllSites.addEventListener('click', () => this.clearAllBlockedSites());

    // Whitelist event listeners
    this.addWhitelistButton.addEventListener('click', () => this.addNewWhitelistPath());
    this.newWhitelistInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addNewWhitelistPath();
    });
    this.clearAllWhitelist.addEventListener('click', () => this.clearAllWhitelistedPaths());

    // Work day checkboxes
    const workDayCheckboxes = document.querySelectorAll('.work-day') as NodeListOf<HTMLInputElement>;
    workDayCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateWorkHoursStatus());
    });

    // Suggestion and preset button listeners
    this.setupSuggestionButtons();
    this.setupPresetButtons();
    this.setupTimePresetButtons();
    this.setupDayPresetButtons();
    
    // History button
    const historyButton = document.getElementById('historyButton');
    if (historyButton) {
      historyButton.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
      });
    }
  }

  /**
   * Setup suggestion buttons for redirect URLs
   */
  private setupSuggestionButtons(): void {
    const suggestionButtons = document.querySelectorAll('.suggestion-btn');
    suggestionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.getAttribute('data-url');
        if (url) {
          this.redirectUrl.value = url;
          this.showStatusMessage({
            text: 'URL updated! Remember to save settings.',
            type: 'success'
          });
        }
      });
    });
  }

  /**
   * Setup preset buttons for redirect delay
   */
  private setupPresetButtons(): void {
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const delay = button.getAttribute('data-delay');
        if (delay) {
          this.redirectDelay.value = delay;
          this.updatePresetButtons();
          this.showStatusMessage({
            text: 'Delay updated! Remember to save settings.',
            type: 'success'
          });
        }
      });
    });
  }

  /**
   * Setup time preset buttons
   */
  private setupTimePresetButtons(): void {
    const timePresetButtons = document.querySelectorAll('.time-preset-btn');
    timePresetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const startTime = button.getAttribute('data-start');
        const endTime = button.getAttribute('data-end');
        if (startTime && endTime) {
          this.workStartTime.value = startTime;
          this.workEndTime.value = endTime;
          this.updateTimePresetButtons();
          this.updateWorkHoursStatus();
          this.showStatusMessage({
            text: 'Work hours updated! Remember to save settings.',
            type: 'success'
          });
        }
      });
    });
  }

  /**
   * Setup day preset buttons
   */
  private setupDayPresetButtons(): void {
    const dayPresetButtons = document.querySelectorAll('.day-preset-btn');
    dayPresetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const daysStr = button.getAttribute('data-days');
        if (daysStr) {
          const days = daysStr.split(',').map(d => parseInt(d.trim()));
          
          // Update checkboxes
          const workDayCheckboxes = document.querySelectorAll('.work-day') as NodeListOf<HTMLInputElement>;
          workDayCheckboxes.forEach(checkbox => {
            checkbox.checked = days.includes(parseInt(checkbox.value));
          });
          
          this.updateWorkHoursStatus();
          this.showStatusMessage({
            text: 'Work days updated! Remember to save settings.',
            type: 'success'
          });
        }
      });
    });
  }

  /**
   * Setup input validation
   */
  private setupInputValidation(): void {
    // Redirect URL validation
    this.redirectUrl.addEventListener('input', () => {
      const url = this.redirectUrl.value.trim();
      if (url && !this.settingsManager.getSuggestedUrls().some(u => u.url === url)) {
        // Basic validation styling could be added here
      }
    });

    // Site input validation
    this.newSiteInput.addEventListener('input', () => {
      const validation = this.siteListManager.validateInput(this.newSiteInput.value);
      // Could add visual feedback here
    });

    // Whitelist input validation
    this.newWhitelistInput.addEventListener('input', () => {
      const validation = this.siteListManager.validateInput(this.newWhitelistInput.value, true);
      // Could add visual feedback here
    });
  }

  /**
   * Update redirect settings visibility
   */
  private updateRedirectVisibility(): void {
    if (this.redirectModeRadio.checked) {
      this.redirectSettings.classList.add('enabled');
      // Auto-focus redirect URL when redirect mode is selected
      setTimeout(() => this.redirectUrl.focus(), UI_CONFIG.ANIMATION_DURATION);
    } else {
      this.redirectSettings.classList.remove('enabled');
    }
  }

  /**
   * Update work hours settings visibility
   */
  private updateWorkHoursVisibility(): void {
    if (this.workHoursEnabled.checked) {
      this.workHoursSettings.classList.add('enabled');
      this.updateWorkHoursStatus();
    } else {
      this.workHoursSettings.classList.remove('enabled');
    }
  }

  /**
   * Update toggle labels
   */
  private updateToggleLabels(): void {
    const extensionLabel = document.getElementById('toggleLabel')!;
    const debugLabel = document.getElementById('debugToggleLabel')!;

    extensionLabel.textContent = this.extensionEnabled.checked ? 'Extension Enabled' : 'Extension Disabled';
    debugLabel.textContent = this.debugEnabled.checked ? 'Debug Enabled' : 'Debug Disabled';
    this.workHoursToggleLabel.textContent = this.workHoursEnabled.checked ? 'Work Hours Enabled' : 'Work Hours Disabled';
  }

  /**
   * Update preset buttons active state
   */
  private updatePresetButtons(): void {
    const currentDelay = parseInt(this.redirectDelay.value);
    const presetButtons = document.querySelectorAll('.preset-btn');
    
    presetButtons.forEach(button => {
      const buttonDelay = parseInt(button.getAttribute('data-delay') || '0');
      if (buttonDelay === currentDelay) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Update time preset buttons active state
   */
  private updateTimePresetButtons(): void {
    const currentStart = this.workStartTime.value;
    const currentEnd = this.workEndTime.value;
    const timePresetButtons = document.querySelectorAll('.time-preset-btn');
    
    timePresetButtons.forEach(button => {
      const buttonStart = button.getAttribute('data-start');
      const buttonEnd = button.getAttribute('data-end');
      if (buttonStart === currentStart && buttonEnd === currentEnd) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Update work hours status display
   */
  private updateWorkHoursStatus(workHours?: WorkHours): void {
    if (!workHours) {
      workHours = this.getCurrentWorkHours();
    }

    const statusText = getWorkHoursStatus(workHours);
    const isWithin = isWithinWorkHours(workHours);

    this.workHoursStatusText.textContent = statusText;
    
    if (workHours.enabled && isWithin) {
      this.workHoursStatusDot.classList.add('active');
    } else {
      this.workHoursStatusDot.classList.remove('active');
    }
  }

  /**
   * Get current work hours from UI
   */
  private getCurrentWorkHours(): WorkHours {
    const workDayCheckboxes = document.querySelectorAll('.work-day:checked') as NodeListOf<HTMLInputElement>;
    const selectedDays = Array.from(workDayCheckboxes).map(cb => parseInt(cb.value));

    return {
      enabled: this.workHoursEnabled.checked,
      startTime: this.workStartTime.value,
      endTime: this.workEndTime.value,
      days: selectedDays
    };
  }

  /**
   * Save current settings
   */
  private async saveCurrentSettings(): Promise<void> {
    const workHours = this.getCurrentWorkHours();

    // Debug log before saving
    if (this.debugEnabled.checked) {
      logger.log('=== SAVING WORK HOURS DEBUG ===');
      logger.log('Work hours from UI:', workHours);
      logger.log('===============================');
    }

    const settings: Partial<ExtensionSettings> = {
      blockMode: this.blockModeRadio.checked ? 'block' : 'redirect',
      redirectUrl: this.redirectUrl.value.trim(),
      redirectDelay: parseInt(this.redirectDelay.value) || 0,
      extensionEnabled: this.extensionEnabled.checked,
      debugEnabled: this.debugEnabled.checked,
      workHours: workHours
    };

    // Save pomodoro settings
    const pomodoroSuccess = await this.pomodoroSettingsManager.saveSettings();
    const settingsSuccess = await this.settingsManager.saveSettingsToStorage(settings);
    
    if (settingsSuccess && pomodoroSuccess) {
      // Animate save button
      this.animateSaveButton();
      // Update work hours status after save
      this.updateWorkHoursStatus(workHours);
      
      // Debug log after saving
      if (this.debugEnabled.checked) {
        setTimeout(async () => {
          await this.settingsManager.debugWorkHours();
        }, 100);
      }
    }
  }

  /**
   * Animate save button on successful save
   */
  private animateSaveButton(): void {
    const originalText = this.saveSettings.textContent;
    this.saveSettings.style.background = '#66BB6A';
    this.saveSettings.textContent = '✓ SAVED';
    
    setTimeout(() => {
      this.saveSettings.style.background = '#4CAF50';
      this.saveSettings.textContent = originalText;
    }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
  }

  /**
   * Reset settings to defaults
   */
  private async resetToDefaults(): Promise<void> {
    const success = await this.settingsManager.resetSettings();
    if (success) {
      await this.loadAndDisplaySettings();
    }
  }

  /**
   * Test redirect URL
   */
  private async testRedirectUrl(): Promise<void> {
    const success = await this.settingsManager.testRedirectUrl(this.redirectUrl.value.trim());
    if (success) {
      // Animate test button
      const originalText = this.testRedirect.textContent;
      this.testRedirect.style.background = '#66BB6A';
      this.testRedirect.textContent = '✓ OPENED';
      
      setTimeout(() => {
        this.testRedirect.style.background = '#FF9800';
        this.testRedirect.textContent = originalText;
      }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
    }
  }

  /**
   * Add new blocked site
   */
  private async addNewSite(): Promise<void> {
    const success = await this.siteListManager.addBlockedSite(this.newSiteInput.value);
    if (success) {
      this.newSiteInput.value = '';
    }
  }

  /**
   * Add new whitelisted path
   */
  private async addNewWhitelistPath(): Promise<void> {
    const success = await this.siteListManager.addWhitelistedPath(this.newWhitelistInput.value);
    if (success) {
      this.newWhitelistInput.value = '';
    }
  }

  /**
   * Clear all blocked sites
   */
  private async clearAllBlockedSites(): Promise<void> {
    await this.siteListManager.clearAllBlockedSites();
  }

  /**
   * Clear all whitelisted paths
   */
  private async clearAllWhitelistedPaths(): Promise<void> {
    await this.siteListManager.clearAllWhitelistedPaths();
  }

  /**
   * Refresh site lists display
   */
  private async refreshSiteLists(): Promise<void> {
    const [blockedSites, whitelistedPaths] = await Promise.all([
      this.siteListManager.loadBlockedWebsites(),
      this.siteListManager.loadWhitelistedPaths()
    ]);

    this.displayBlockedSites(blockedSites);
    this.displayWhitelistedPaths(whitelistedPaths);
    this.updateSiteCounts(blockedSites.length, whitelistedPaths.length);
  }

  /**
   * Display blocked sites list
   */
  private displayBlockedSites(sites: string[]): void {
    if (sites.length === 0) {
      this.blockedSitesList.innerHTML = `
        <div class="empty-state">
          <p>No sites blocked yet</p>
          <small>Add a website above to get started</small>
        </div>
      `;
      this.clearAllSites.disabled = true;
      return;
    }

    this.clearAllSites.disabled = false;

    const sitesHTML = sites.map((site, index) => {
      const siteType = this.siteListManager.getSiteTypeLabel(site);
      return `
        <div class="site-item" data-index="${index}">
          <div style="display: flex; align-items: center; flex: 1;">
            <span class="site-url">${site}</span>
            ${siteType ? `<span class="site-type">${siteType}</span>` : ''}
          </div>
          <button class="remove-site-btn" data-site="${site}">Remove</button>
        </div>
      `;
    }).join('');

    this.blockedSitesList.innerHTML = sitesHTML;

    // Add remove button listeners
    this.blockedSitesList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const site = button.getAttribute('data-site');
        if (site) {
          await this.siteListManager.removeBlockedSite(site);
        }
      });
    });
  }

  /**
   * Display whitelisted paths list
   */
  private displayWhitelistedPaths(paths: string[]): void {
    if (paths.length === 0) {
      this.whitelistedPathsList.innerHTML = `
        <div class="empty-state">
          <p>No paths whitelisted yet</p>
          <small>Add a whitelisted path above to get started</small>
        </div>
      `;
      this.clearAllWhitelist.disabled = true;
      return;
    }

    this.clearAllWhitelist.disabled = false;

    const pathsHTML = paths.map((path, index) => {
      const pathType = this.siteListManager.getSiteTypeLabel(path);
      return `
        <div class="site-item" data-index="${index}">
          <div style="display: flex; align-items: center; flex: 1;">
            <span class="site-url">${path}</span>
            ${pathType ? `<span class="site-type whitelist-type">${pathType}</span>` : ''}
          </div>
          <button class="remove-site-btn" data-path="${path}">Remove</button>
        </div>
      `;
    }).join('');

    this.whitelistedPathsList.innerHTML = pathsHTML;

    // Add remove button listeners
    this.whitelistedPathsList.querySelectorAll('.remove-site-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const path = button.getAttribute('data-path');
        if (path) {
          await this.siteListManager.removeWhitelistedPath(path);
        }
      });
    });
  }

  /**
   * Update site counts display
   */
  private updateSiteCounts(blockedCount: number, whitelistedCount: number): void {
    this.sitesCount.textContent = `${blockedCount} site${blockedCount !== 1 ? 's' : ''} blocked`;
    this.whitelistCount.textContent = `${whitelistedCount} path${whitelistedCount !== 1 ? 's' : ''} whitelisted`;
  }

  /**
   * Show status message with auto-hide
   */
  private showStatusMessage(message: StatusMessage): void {
    this.statusMessage.textContent = message.text;
    this.statusMessage.className = `status-message ${message.type} show`;
    
    // Hide message after specified duration or default
    setTimeout(() => {
      this.statusMessage.classList.remove('show');
    }, message.duration || UI_CONFIG.STATUS_MESSAGE_DURATION);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsPageManager();
});