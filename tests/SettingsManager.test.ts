import { SettingsManager } from '@options/SettingsManager';
import { ExtensionSettings, StatusMessage, WorkHours } from '@shared/types';
import * as storage from '@shared/storage';
import * as urlUtils from '@shared/urlUtils';
import * as workHoursUtils from '@shared/workHoursUtils';

// Mock dependencies
jest.mock('@shared/storage');
jest.mock('@shared/urlUtils');
jest.mock('@shared/workHoursUtils');
jest.mock('@shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    create: jest.fn().mockResolvedValue({})
  },
  storage: {
    sync: {
      get: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;
(global as any).confirm = jest.fn();

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockUrlUtils = urlUtils as jest.Mocked<typeof urlUtils>;
const mockWorkHoursUtils = workHoursUtils as jest.Mocked<typeof workHoursUtils>;

describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  let onStatusMessage: jest.Mock;

  const defaultSettings: ExtensionSettings = {
    blockMode: 'block',
    redirectUrl: 'https://example.com',
    redirectDelay: 3,
    extensionEnabled: true,
    debugEnabled: false,
    workHours: {
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
      days: [1, 2, 3, 4, 5]
    },
    pomodoro: {
      workDuration: 25,
      restDuration: 5,
      longRestDuration: 15,
      longRestInterval: 4,
      autoStartRest: true,
      autoStartWork: true,
      showNotifications: true,
      playSound: true
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onStatusMessage = jest.fn();
    settingsManager = new SettingsManager(onStatusMessage);

    // Setup default mocks
    mockStorage.getSettings.mockResolvedValue(defaultSettings);
    mockStorage.saveSettings.mockResolvedValue();
    mockStorage.resetSettings.mockResolvedValue();
    mockUrlUtils.isValidUrl.mockReturnValue(true);
    mockWorkHoursUtils.isValidTimeString.mockReturnValue(true);
  });

  describe('Constructor', () => {
    test('should create SettingsManager with status message callback', () => {
      expect(settingsManager).toBeInstanceOf(SettingsManager);
    });

    test('should create SettingsManager without status message callback', () => {
      const managerWithoutCallback = new SettingsManager();
      expect(managerWithoutCallback).toBeInstanceOf(SettingsManager);
    });
  });

  describe('Loading Settings', () => {
    test('should load settings successfully', async () => {
      const settings = await settingsManager.loadSettings();
      
      expect(mockStorage.getSettings).toHaveBeenCalled();
      expect(settings).toEqual(defaultSettings);
    });

    test('should handle loading errors gracefully', async () => {
      mockStorage.getSettings.mockRejectedValue(new Error('Storage error'));
      
      const settings = await settingsManager.loadSettings();
      
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error loading settings: Storage error',
        type: 'error'
      });
      expect(settings).toEqual(expect.objectContaining({
        blockMode: 'block',
        extensionEnabled: true
      }));
    });
  });

  describe('Saving Settings', () => {
    test('should save valid settings successfully', async () => {
      const settingsToSave = {
        blockMode: 'redirect' as const,
        redirectUrl: 'https://valid-url.com'
      };
      
      const result = await settingsManager.saveSettingsToStorage(settingsToSave);
      
      expect(result).toBe(true);
      expect(mockStorage.saveSettings).toHaveBeenCalledWith(settingsToSave);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Settings saved successfully!',
        type: 'success'
      });
    });

    test('should validate settings before saving', async () => {
      const invalidSettings = {
        blockMode: 'redirect' as const,
        redirectUrl: '' // Invalid: empty URL for redirect mode
      };
      
      const result = await settingsManager.saveSettingsToStorage(invalidSettings);
      
      expect(result).toBe(false);
      expect(mockStorage.saveSettings).not.toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a redirect URL.',
        type: 'error'
      });
    });

    test('should handle save errors', async () => {
      mockStorage.saveSettings.mockRejectedValue(new Error('Save failed'));
      
      const result = await settingsManager.saveSettingsToStorage({ blockMode: 'block' });
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error saving settings: Save failed',
        type: 'error'
      });
    });
  });

  describe('Settings Validation', () => {
    test('should validate redirect URL when in redirect mode', () => {
      mockUrlUtils.isValidUrl.mockReturnValue(false);
      
      const invalidSettings = {
        blockMode: 'redirect' as const,
        redirectUrl: 'invalid-url'
      };
      
      const result = settingsManager['validateSettings'](invalidSettings);
      
      expect(result).toBe('Please enter a valid URL (must start with http:// or https://).');
    });

    test('should require redirect URL for redirect mode', () => {
      const invalidSettings = {
        blockMode: 'redirect' as const,
        redirectUrl: ''
      };
      
      const result = settingsManager['validateSettings'](invalidSettings);
      
      expect(result).toBe('Please enter a redirect URL.');
    });

    test('should validate redirect delay range', () => {
      const invalidSettings = {
        redirectDelay: 35 // Too high
      };
      
      const result = settingsManager['validateSettings'](invalidSettings);
      
      expect(result).toBe('Redirect delay must be between 0 and 30 seconds.');
    });

    test('should validate work hours', () => {
      const invalidWorkHours: WorkHours = {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: [] // Invalid: no days selected
      };
      
      const result = settingsManager.validateWorkHours(invalidWorkHours);
      
      expect(result).toBe('Please select at least one work day.');
    });

    test('should skip work hours validation when disabled', () => {
      const disabledWorkHours: WorkHours = {
        enabled: false,
        startTime: 'invalid',
        endTime: 'invalid',
        days: []
      };
      
      const result = settingsManager.validateWorkHours(disabledWorkHours);
      
      expect(result).toBeNull();
    });
  });

  describe('Work Hours Validation', () => {
    test('should validate time format', () => {
      mockWorkHoursUtils.isValidTimeString.mockReturnValue(false);
      
      const invalidWorkHours: WorkHours = {
        enabled: true,
        startTime: 'invalid-time',
        endTime: '17:00',
        days: [1, 2, 3]
      };
      
      const result = settingsManager.validateWorkHours(invalidWorkHours);
      
      expect(result).toBe('Please enter a valid start time in HH:MM format.');
    });

    test('should validate day values', () => {
      const invalidWorkHours: WorkHours = {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: [1, 2, 7] // Invalid: 7 is not a valid day
      };
      
      const result = settingsManager.validateWorkHours(invalidWorkHours);
      
      expect(result).toBe('Invalid day selected. Days must be between 0 (Sunday) and 6 (Saturday).');
    });

    test('should validate that at least one day is selected', () => {
      const invalidWorkHours: WorkHours = {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: []
      };
      
      const result = settingsManager.validateWorkHours(invalidWorkHours);
      
      expect(result).toBe('Please select at least one work day.');
    });

    test('should validate end time format', () => {
      mockWorkHoursUtils.isValidTimeString
        .mockReturnValueOnce(true)  // Start time is valid
        .mockReturnValueOnce(false); // End time is invalid
      
      const invalidWorkHours: WorkHours = {
        enabled: true,
        startTime: '09:00',
        endTime: 'invalid-time',
        days: [1, 2, 3]
      };
      
      const result = settingsManager.validateWorkHours(invalidWorkHours);
      
      expect(result).toBe('Please enter a valid end time in HH:MM format.');
    });
  });

  describe('Reset Settings', () => {
    test('should reset settings when confirmed', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      
      const result = await settingsManager.resetSettings();
      
      expect(result).toBe(true);
      expect(mockStorage.resetSettings).toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Settings reset to defaults!',
        type: 'success'
      });
    });

    test('should not reset settings when cancelled', async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);
      
      const result = await settingsManager.resetSettings();
      
      expect(result).toBe(false);
      expect(mockStorage.resetSettings).not.toHaveBeenCalled();
    });

    test('should handle reset errors', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      mockStorage.resetSettings.mockRejectedValue(new Error('Reset failed'));
      
      const result = await settingsManager.resetSettings();
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error resetting settings: Reset failed',
        type: 'error'
      });
    });
  });

  describe('Test Redirect URL', () => {
    test('should test valid URL successfully', async () => {
      const result = await settingsManager.testRedirectUrl('https://example.com');
      
      expect(result).toBe(true);
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        active: false
      });
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Test URL opened in new tab!',
        type: 'success'
      });
    });

    test('should reject empty URL', async () => {
      const result = await settingsManager.testRedirectUrl('  ');
      
      expect(result).toBe(false);
      expect(mockChrome.tabs.create).not.toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a URL to test.',
        type: 'error'
      });
    });

    test('should reject invalid URL', async () => {
      mockUrlUtils.isValidUrl.mockReturnValue(false);
      
      const result = await settingsManager.testRedirectUrl('invalid-url');
      
      expect(result).toBe(false);
      expect(mockChrome.tabs.create).not.toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a valid URL (must start with http:// or https://).',
        type: 'error'
      });
    });

    test('should handle tab creation errors', async () => {
      mockChrome.tabs.create.mockRejectedValue(new Error('Tab creation failed'));
      
      const result = await settingsManager.testRedirectUrl('https://example.com');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error opening URL: Tab creation failed',
        type: 'error'
      });
    });
  });

  describe('Configuration Getters', () => {
    test('should return suggested URLs', () => {
      const urls = settingsManager.getSuggestedUrls();
      
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toHaveProperty('url');
      expect(urls[0]).toHaveProperty('label');
    });

    test('should return delay presets', () => {
      const presets = settingsManager.getDelayPresets();
      
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
      expect(presets[0]).toHaveProperty('value');
      expect(presets[0]).toHaveProperty('label');
    });

    test('should return work hours config', () => {
      const config = settingsManager.getWorkHoursConfig();
      
      expect(config).toHaveProperty('DAYS_OF_WEEK');
      expect(config).toHaveProperty('TIME_PRESETS');
    });
  });

  describe('Debug Work Hours', () => {
    test('should log work hours debug information', async () => {
      mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          workHoursEnabled: true,
          workHoursStartTime: '09:00',
          workHoursEndTime: '17:00',
          workHoursDays: [1, 2, 3, 4, 5]
        });
      });
      
      await settingsManager.debugWorkHours();
      
      expect(mockStorage.getSettings).toHaveBeenCalled();
      expect(mockChrome.storage.sync.get).toHaveBeenCalled();
    });

    test('should handle debug errors gracefully', async () => {
      mockStorage.getSettings.mockRejectedValue(new Error('Debug error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // The error is caught and logged, so we should expect the function to not throw
      await expect(settingsManager.debugWorkHours()).resolves.not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });
});