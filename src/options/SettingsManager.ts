import { ExtensionSettings, StatusMessage, WorkHours } from '@shared/types';
import { getSettings, saveSettings, resetSettings as resetToDefaults } from '@shared/storage';
import { DEFAULT_SETTINGS, SUGGESTED_REDIRECT_URLS, DELAY_PRESETS, WORK_HOURS_CONFIG } from '@shared/constants';
import { isValidUrl } from '@shared/urlUtils';
import { isValidTimeString } from '@shared/workHoursUtils';
import { logger } from '@shared/logger';

export class SettingsManager {
  private onStatusMessage: ((message: StatusMessage) => void) | undefined;

  constructor(onStatusMessage?: (message: StatusMessage) => void) {
    this.onStatusMessage = onStatusMessage;
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<ExtensionSettings> {
    try {
      return await getSettings();
    } catch (error) {
      this.showStatusMessage({
        text: `Error loading settings: ${(error as Error).message}`,
        type: 'error'
      });
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettingsToStorage(settings: Partial<ExtensionSettings>): Promise<boolean> {
    try {
      // Validate settings before saving
      const validationError = this.validateSettings(settings);
      if (validationError) {
        this.showStatusMessage({
          text: validationError,
          type: 'error'
        });
        return false;
      }

      await saveSettings(settings);
      this.showStatusMessage({
        text: 'Settings saved successfully!',
        type: 'success'
      });
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error saving settings: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<boolean> {
    if (!confirm('Are you sure you want to reset all settings to defaults? This will not affect your blocked sites list or whitelisted paths.')) {
      return false;
    }

    try {
      await resetToDefaults();
      this.showStatusMessage({
        text: 'Settings reset to defaults!',
        type: 'success'
      });
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error resetting settings: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Test redirect URL by opening it in a new tab
   */
  async testRedirectUrl(url: string): Promise<boolean> {
    if (!url.trim()) {
      this.showStatusMessage({
        text: 'Please enter a URL to test.',
        type: 'error'
      });
      return false;
    }

    if (!isValidUrl(url)) {
      this.showStatusMessage({
        text: 'Please enter a valid URL (must start with http:// or https://).',
        type: 'error'
      });
      return false;
    }

    try {
      await chrome.tabs.create({ url, active: false });
      this.showStatusMessage({
        text: 'Test URL opened in new tab!',
        type: 'success'
      });
      return true;
    } catch (error) {
      this.showStatusMessage({
        text: `Error opening URL: ${(error as Error).message}`,
        type: 'error'
      });
      return false;
    }
  }

  /**
   * Get suggested redirect URLs
   */
  getSuggestedUrls(): Array<{ url: string; label: string }> {
    return SUGGESTED_REDIRECT_URLS;
  }

  /**
   * Get delay presets
   */
  getDelayPresets(): Array<{ value: number; label: string }> {
    return DELAY_PRESETS;
  }

  /**
   * Get work hours configuration options
   */
  getWorkHoursConfig(): typeof WORK_HOURS_CONFIG {
    return WORK_HOURS_CONFIG;
  }

  /**
   * Validate work hours settings
   */
  validateWorkHours(workHours: WorkHours): string | null {
    if (!workHours.enabled) {
      return null; // No validation needed if disabled
    }

    // Validate time format
    if (!isValidTimeString(workHours.startTime)) {
      return 'Please enter a valid start time in HH:MM format.';
    }

    if (!isValidTimeString(workHours.endTime)) {
      return 'Please enter a valid end time in HH:MM format.';
    }

    // Validate that at least one day is selected
    if (!workHours.days || workHours.days.length === 0) {
      return 'Please select at least one work day.';
    }

    // Validate day values
    if (workHours.days.some(day => day < 0 || day > 6)) {
      return 'Invalid day selected. Days must be between 0 (Sunday) and 6 (Saturday).';
    }

    return null;
  }

  /**
   * Debug: Log current work hours settings to console
   */
  async debugWorkHours(): Promise<void> {
    try {
      const settings = await this.loadSettings();
      logger.log('=== WORK HOURS DEBUG ===');
      logger.log('Current settings:', settings);
      logger.log('Work hours enabled:', settings.workHours.enabled);
      logger.log('Work hours start time:', settings.workHours.startTime);
      logger.log('Work hours end time:', settings.workHours.endTime);
      logger.log('Work hours days:', settings.workHours.days);
      logger.log('========================');
      
      // Also check raw storage
      chrome.storage.sync.get(null, (data) => {
        logger.log('=== RAW STORAGE DEBUG ===');
        logger.log('All storage data:', data);
        logger.log('Work hours enabled:', data.workHoursEnabled);
        logger.log('Work hours start:', data.workHoursStartTime);
        logger.log('Work hours end:', data.workHoursEndTime);
        logger.log('Work hours days:', data.workHoursDays);
        logger.log('=========================');
      });
    } catch (error) {
      console.error('Error debugging work hours:', error);
    }
  }

  /**
   * Validate settings before saving
   */
  private validateSettings(settings: Partial<ExtensionSettings>): string | null {
    // Validate redirect URL if redirect mode is selected
    if (settings.blockMode === 'redirect') {
      if (!settings.redirectUrl) {
        return 'Please enter a redirect URL.';
      }

      if (!isValidUrl(settings.redirectUrl)) {
        return 'Please enter a valid URL (must start with http:// or https://).';
      }
    }

    // Validate redirect delay
    if (settings.redirectDelay !== undefined) {
      if (settings.redirectDelay < 0 || settings.redirectDelay > 30) {
        return 'Redirect delay must be between 0 and 30 seconds.';
      }
    }

    // Validate work hours
    if (settings.workHours !== undefined) {
      const workHoursError = this.validateWorkHours(settings.workHours);
      if (workHoursError) {
        return workHoursError;
      }
    }

    return null;
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