import {
  getStorageData,
  setStorageData,
  getWorkHours,
  saveWorkHours,
  getSettings,
  saveSettings,
  getBlockedWebsites,
  saveBlockedWebsites,
  addBlockedWebsite,
  removeBlockedWebsite,
  getWhitelistedPaths,
  saveWhitelistedPaths,
  addWhitelistedPath,
  removeWhitelistedPath,
  clearAllBlockedWebsites,
  clearAllWhitelistedPaths,
  resetSettings,
  onStorageChanged
} from '@shared/storage';
import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_WORK_HOURS } from '@shared/constants';

describe('Storage utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.storage.sync.get as jest.Mock).mockClear();
    (chrome.storage.sync.set as jest.Mock).mockClear();
    (chrome.storage.local.get as jest.Mock).mockClear();
    (chrome.storage.local.set as jest.Mock).mockClear();
    delete chrome.runtime.lastError;
  });

  describe('getStorageData', () => {
    test('should get data from sync storage by default', async () => {
      const mockData = { setting1: 'value1' };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getStorageData('setting1' as any);
      
      expect(chrome.storage.sync.get).toHaveBeenCalledWith('setting1', expect.any(Function));
      expect(result).toEqual(mockData);
    });

    test('should get data from local storage when useLocal is true', async () => {
      const mockData = { setting1: 'value1' };
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getStorageData('setting1' as any, true);
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith('setting1', expect.any(Function));
      expect(result).toEqual(mockData);
    });

    test('should handle chrome runtime errors', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(getStorageData('setting1' as any)).rejects.toThrow('Storage error');
    });

    test('should handle array of keys', async () => {
      const mockData = { setting1: 'value1', setting2: 'value2' };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getStorageData(['setting1', 'setting2'] as any);
      
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['setting1', 'setting2'], expect.any(Function));
      expect(result).toEqual(mockData);
    });
  });

  describe('setStorageData', () => {
    test('should set data in sync storage by default', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const dataToSet = { extensionEnabled: true };
      await setStorageData(dataToSet);
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(dataToSet, expect.any(Function));
    });

    test('should set data in local storage when useLocal is true', async () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const dataToSet = { debugEnabled: false };
      await setStorageData(dataToSet, true);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(dataToSet, expect.any(Function));
    });

    test('should handle chrome runtime errors', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await expect(setStorageData({ redirectUrl: 'test' })).rejects.toThrow('Storage error');
    });
  });

  describe('getWorkHours', () => {
    test('should return work hours from storage', async () => {
      const mockData = {
        workHoursEnabled: true,
        workHoursStartTime: '09:00',
        workHoursEndTime: '17:00',
        workHoursDays: [1, 2, 3, 4, 5]
      };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getWorkHours();
      
      expect(result).toEqual({
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: [1, 2, 3, 4, 5]
      });
    });

    test('should return default work hours when storage is empty', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getWorkHours();
      
      expect(result).toEqual(DEFAULT_WORK_HOURS);
    });

    test('should return default work hours on error', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getWorkHours();
      
      expect(result).toEqual(DEFAULT_WORK_HOURS);
    });
  });

  describe('saveWorkHours', () => {
    test('should save work hours to storage', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const workHours = {
        enabled: true,
        startTime: '08:00',
        endTime: '18:00',
        days: [1, 2, 3, 4, 5, 6]
      };

      await saveWorkHours(workHours);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        workHoursEnabled: true,
        workHoursStartTime: '08:00',
        workHoursEndTime: '18:00',
        workHoursDays: [1, 2, 3, 4, 5, 6]
      }, expect.any(Function));
    });

    test('should throw error when storage fails', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const workHours = DEFAULT_WORK_HOURS;
      await expect(saveWorkHours(workHours)).rejects.toThrow('Storage error');
    });
  });

  describe('getBlockedWebsites', () => {
    test('should return blocked websites from storage', async () => {
      const mockData = { blockedWebsitesArray: ['youtube.com', 'facebook.com'] };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getBlockedWebsites();
      
      expect(result).toEqual(['youtube.com', 'facebook.com']);
    });

    test('should return empty array when storage is empty', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getBlockedWebsites();
      
      expect(result).toEqual([]);
    });

    test('should return empty array on error', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getBlockedWebsites();
      
      expect(result).toEqual([]);
    });
  });

  describe('addBlockedWebsite', () => {
    test('should add new website to blocked list', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ blockedWebsitesArray: ['youtube.com'] });
      });
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const result = await addBlockedWebsite('facebook.com');
      
      expect(result).toEqual(['youtube.com', 'facebook.com']);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.BLOCKED_WEBSITES]: ['youtube.com', 'facebook.com'] },
        expect.any(Function)
      );
    });

    test('should not add duplicate website', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ blockedWebsitesArray: ['youtube.com'] });
      });
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const result = await addBlockedWebsite('youtube.com');
      
      expect(result).toEqual(['youtube.com']);
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });
  });

  describe('removeBlockedWebsite', () => {
    test('should remove website from blocked list', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ blockedWebsitesArray: ['youtube.com', 'facebook.com'] });
      });
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const result = await removeBlockedWebsite('youtube.com');
      
      expect(result).toEqual(['facebook.com']);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.BLOCKED_WEBSITES]: ['facebook.com'] },
        expect.any(Function)
      );
    });
  });

  describe('getWhitelistedPaths', () => {
    test('should return whitelisted paths from storage', async () => {
      const mockData = { whitelistedPathsArray: ['music.youtube.com', 'reddit.com/r/programming'] };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getWhitelistedPaths();
      
      expect(result).toEqual(['music.youtube.com', 'reddit.com/r/programming']);
    });

    test('should return empty array when storage is empty', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getWhitelistedPaths();
      
      expect(result).toEqual([]);
    });
  });

  describe('clearAllBlockedWebsites', () => {
    test('should clear all blocked websites', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await clearAllBlockedWebsites();
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.BLOCKED_WEBSITES]: [] },
        expect.any(Function)
      );
    });
  });

  describe('clearAllWhitelistedPaths', () => {
    test('should clear all whitelisted paths', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await clearAllWhitelistedPaths();
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [STORAGE_KEYS.WHITELISTED_PATHS]: [] },
        expect.any(Function)
      );
    });
  });

  describe('onStorageChanged', () => {
    test('should add storage change listener', () => {
      const callback = jest.fn();
      
      onStorageChanged(callback);
      
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(callback);
    });
  });

  describe('getSettings', () => {
    test('should return settings with defaults', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getSettings();
      
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    test('should return merged settings from storage', async () => {
      const mockData = {
        blockMode: 'REDIRECT',
        redirectUrl: 'https://custom.com',
        workHoursEnabled: true
      };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback(mockData);
      });

      const result = await getSettings();
      
      expect(result.blockMode).toBe('REDIRECT');
      expect(result.redirectUrl).toBe('https://custom.com');
      expect(result.workHours.enabled).toBe(true);
    });
  });

  describe('saveSettings', () => {
    test('should save partial settings to storage', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const settingsToSave = {
        blockMode: 'redirect' as const,
        redirectUrl: 'https://custom.com',
        extensionEnabled: false
      };

      await saveSettings(settingsToSave);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        blockMode: 'redirect',
        redirectUrl: 'https://custom.com',
        extensionEnabled: false
      }, expect.any(Function));
    });

    test('should save work hours settings', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const settingsToSave = {
        workHours: {
          enabled: true,
          startTime: '09:00',
          endTime: '17:00',
          days: [1, 2, 3, 4, 5]
        }
      };

      await saveSettings(settingsToSave);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        workHoursEnabled: true,
        workHoursStartTime: '09:00',
        workHoursEndTime: '17:00',
        workHoursDays: [1, 2, 3, 4, 5]
      }, expect.any(Function));
    });
  });

  describe('resetSettings', () => {
    test('should reset all settings to defaults', async () => {
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await resetSettings();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          blockMode: DEFAULT_SETTINGS.blockMode,
          redirectUrl: DEFAULT_SETTINGS.redirectUrl
        }),
        expect.any(Function)
      );
    });
  });
});