import { ExtensionSettings, StatusMessage } from '@shared/types';
import { getSettings, saveSettings, resetSettings as resetToDefaults } from '@shared/storage';
import { DEFAULT_SETTINGS, SUGGESTED_REDIRECT_URLS, DELAY_PRESETS } from '@shared/constants';
import { isValidUrl } from '@shared/urlUtils';

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