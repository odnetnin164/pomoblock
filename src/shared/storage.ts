// src/shared/storage.ts
import { ExtensionSettings, StorageData, WorkHours, SiteToggleState } from './types';
import { DEFAULT_SETTINGS, DEFAULT_WORK_HOURS, STORAGE_KEYS } from './constants';

/**
 * Get data from Chrome storage with type safety and error handling
 */
export async function getStorageData<T extends keyof StorageData>(
  keys: T | T[],
  useLocal: boolean = false
): Promise<Pick<StorageData, T>> {
  return new Promise((resolve, reject) => {
    const storage = useLocal ? chrome.storage.local : chrome.storage.sync;
    storage.get(keys, (data) => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(data as Pick<StorageData, T>);
      }
    });
  });
}

/**
 * Set data in Chrome storage with error handling
 */
export async function setStorageData(data: Partial<StorageData>, useLocal: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const storage = useLocal ? chrome.storage.local : chrome.storage.sync;
    storage.set(data, () => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get work hours settings with defaults and error handling
 */
export async function getWorkHours(): Promise<WorkHours> {
  try {
    const data = await getStorageData([
      STORAGE_KEYS.WORK_HOURS_ENABLED,
      STORAGE_KEYS.WORK_HOURS_START_TIME,
      STORAGE_KEYS.WORK_HOURS_END_TIME,
      STORAGE_KEYS.WORK_HOURS_DAYS
    ]);

    return {
      enabled: data.workHoursEnabled ?? DEFAULT_WORK_HOURS.enabled,
      startTime: data.workHoursStartTime ?? DEFAULT_WORK_HOURS.startTime,
      endTime: data.workHoursEndTime ?? DEFAULT_WORK_HOURS.endTime,
      days: data.workHoursDays ?? DEFAULT_WORK_HOURS.days
    };
  } catch (error) {
    console.error('Error getting work hours, using defaults:', error);
    return DEFAULT_WORK_HOURS;
  }
}

/**
 * Save work hours settings with error handling
 */
export async function saveWorkHours(workHours: WorkHours): Promise<void> {
  try {
    const dataToSave: Partial<StorageData> = {
      workHoursEnabled: workHours.enabled,
      workHoursStartTime: workHours.startTime,
      workHoursEndTime: workHours.endTime,
      workHoursDays: workHours.days
    };

    await setStorageData(dataToSave);
  } catch (error) {
    console.error('Error saving work hours:', error);
    throw error;
  }
}

/**
 * Get extension settings with defaults and error handling
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const data = await getStorageData([
      STORAGE_KEYS.BLOCK_MODE,
      STORAGE_KEYS.REDIRECT_URL,
      STORAGE_KEYS.REDIRECT_DELAY,
      STORAGE_KEYS.EXTENSION_ENABLED,
      STORAGE_KEYS.DEBUG_ENABLED,
      STORAGE_KEYS.WORK_HOURS_ENABLED,
      STORAGE_KEYS.WORK_HOURS_START_TIME,
      STORAGE_KEYS.WORK_HOURS_END_TIME,
      STORAGE_KEYS.WORK_HOURS_DAYS
    ]);

    const workHours: WorkHours = {
      enabled: data.workHoursEnabled ?? DEFAULT_WORK_HOURS.enabled,
      startTime: data.workHoursStartTime ?? DEFAULT_WORK_HOURS.startTime,
      endTime: data.workHoursEndTime ?? DEFAULT_WORK_HOURS.endTime,
      days: data.workHoursDays ?? DEFAULT_WORK_HOURS.days
    };

    return {
      blockMode: data.blockMode ?? DEFAULT_SETTINGS.blockMode,
      redirectUrl: data.redirectUrl ?? DEFAULT_SETTINGS.redirectUrl,
      redirectDelay: data.redirectDelay ?? DEFAULT_SETTINGS.redirectDelay,
      extensionEnabled: data.extensionEnabled ?? DEFAULT_SETTINGS.extensionEnabled,
      debugEnabled: data.debugEnabled ?? DEFAULT_SETTINGS.debugEnabled,
      workHours,
      pomodoro: DEFAULT_SETTINGS.pomodoro // Add the missing pomodoro property
    };
  } catch (error) {
    console.error('Error getting settings, using defaults:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save extension settings with error handling
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  try {
    const dataToSave: Partial<StorageData> = {};
    
    if (settings.blockMode !== undefined) {
      dataToSave.blockMode = settings.blockMode;
    }
    if (settings.redirectUrl !== undefined) {
      dataToSave.redirectUrl = settings.redirectUrl;
    }
    if (settings.redirectDelay !== undefined) {
      dataToSave.redirectDelay = settings.redirectDelay;
    }
    if (settings.extensionEnabled !== undefined) {
      dataToSave.extensionEnabled = settings.extensionEnabled;
    }
    if (settings.debugEnabled !== undefined) {
      dataToSave.debugEnabled = settings.debugEnabled;
    }
    if (settings.workHours !== undefined) {
      dataToSave.workHoursEnabled = settings.workHours.enabled;
      dataToSave.workHoursStartTime = settings.workHours.startTime;
      dataToSave.workHoursEndTime = settings.workHours.endTime;
      dataToSave.workHoursDays = settings.workHours.days;
    }
    // Note: Pomodoro settings are handled separately in pomodoroStorage.ts

    await setStorageData(dataToSave);
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * Get blocked websites list with error handling
 */
export async function getBlockedWebsites(): Promise<string[]> {
  try {
    const data = await getStorageData(STORAGE_KEYS.BLOCKED_WEBSITES);
    return data.blockedWebsitesArray ?? [];
  } catch (error) {
    console.error('Error getting blocked websites:', error);
    return [];
  }
}

/**
 * Save blocked websites list with error handling
 */
export async function saveBlockedWebsites(websites: string[]): Promise<void> {
  try {
    await setStorageData({ [STORAGE_KEYS.BLOCKED_WEBSITES]: websites });
  } catch (error) {
    console.error('Error saving blocked websites:', error);
    throw error;
  }
}

/**
 * Add website to blocked list with error handling
 */
export async function addBlockedWebsite(website: string): Promise<string[]> {
  try {
    const currentWebsites = await getBlockedWebsites();
    if (!currentWebsites.includes(website)) {
      currentWebsites.push(website);
      await saveBlockedWebsites(currentWebsites);
    }
    return currentWebsites;
  } catch (error) {
    console.error('Error adding blocked website:', error);
    throw error;
  }
}

/**
 * Remove website from blocked list with error handling
 */
export async function removeBlockedWebsite(website: string): Promise<string[]> {
  try {
    const currentWebsites = await getBlockedWebsites();
    const updatedWebsites = currentWebsites.filter(site => site !== website);
    await saveBlockedWebsites(updatedWebsites);
    return updatedWebsites;
  } catch (error) {
    console.error('Error removing blocked website:', error);
    throw error;
  }
}

/**
 * Get whitelisted paths list with error handling
 */
export async function getWhitelistedPaths(): Promise<string[]> {
  try {
    const data = await getStorageData(STORAGE_KEYS.WHITELISTED_PATHS);
    return data.whitelistedPathsArray ?? [];
  } catch (error) {
    console.error('Error getting whitelisted paths:', error);
    return [];
  }
}

/**
 * Save whitelisted paths list with error handling
 */
export async function saveWhitelistedPaths(paths: string[]): Promise<void> {
  try {
    await setStorageData({ [STORAGE_KEYS.WHITELISTED_PATHS]: paths });
  } catch (error) {
    console.error('Error saving whitelisted paths:', error);
    throw error;
  }
}

/**
 * Add path to whitelist with error handling
 */
export async function addWhitelistedPath(path: string): Promise<string[]> {
  try {
    const currentPaths = await getWhitelistedPaths();
    if (!currentPaths.includes(path)) {
      currentPaths.push(path);
      await saveWhitelistedPaths(currentPaths);
    }
    return currentPaths;
  } catch (error) {
    console.error('Error adding whitelisted path:', error);
    throw error;
  }
}

/**
 * Remove path from whitelist with error handling
 */
export async function removeWhitelistedPath(path: string): Promise<string[]> {
  try {
    const currentPaths = await getWhitelistedPaths();
    const updatedPaths = currentPaths.filter(p => p !== path);
    await saveWhitelistedPaths(updatedPaths);
    return updatedPaths;
  } catch (error) {
    console.error('Error removing whitelisted path:', error);
    throw error;
  }
}

/**
 * Clear all blocked websites with error handling
 */
export async function clearAllBlockedWebsites(): Promise<void> {
  try {
    await saveBlockedWebsites([]);
  } catch (error) {
    console.error('Error clearing blocked websites:', error);
    throw error;
  }
}

/**
 * Clear all whitelisted paths with error handling
 */
export async function clearAllWhitelistedPaths(): Promise<void> {
  try {
    await saveWhitelistedPaths([]);
  } catch (error) {
    console.error('Error clearing whitelisted paths:', error);
    throw error;
  }
}

/**
 * Reset all settings to defaults with error handling
 */
export async function resetSettings(): Promise<void> {
  try {
    await saveSettings(DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Error resetting settings:', error);
    throw error;
  }
}

/**
 * Get blocked sites toggle state
 */
export async function getBlockedSitesToggleState(): Promise<SiteToggleState> {
  try {
    const data = await getStorageData(STORAGE_KEYS.BLOCKED_SITES_TOGGLE_STATE);
    return data.blockedSitesToggleState ?? {};
  } catch (error) {
    console.error('Error getting blocked sites toggle state:', error);
    return {};
  }
}

/**
 * Save blocked sites toggle state
 */
export async function saveBlockedSitesToggleState(toggleState: SiteToggleState): Promise<void> {
  try {
    await setStorageData({ [STORAGE_KEYS.BLOCKED_SITES_TOGGLE_STATE]: toggleState });
  } catch (error) {
    console.error('Error saving blocked sites toggle state:', error);
    throw error;
  }
}

/**
 * Toggle blocked site enabled/disabled state
 */
export async function toggleBlockedSite(website: string): Promise<boolean> {
  try {
    const toggleState = await getBlockedSitesToggleState();
    const newState = !(toggleState[website] ?? true); // Default to enabled if not set
    toggleState[website] = newState;
    await saveBlockedSitesToggleState(toggleState);
    return newState;
  } catch (error) {
    console.error('Error toggling blocked site:', error);
    throw error;
  }
}

/**
 * Get whitelisted paths toggle state
 */
export async function getWhitelistedPathsToggleState(): Promise<SiteToggleState> {
  try {
    const data = await getStorageData(STORAGE_KEYS.WHITELISTED_PATHS_TOGGLE_STATE);
    return data.whitelistedPathsToggleState ?? {};
  } catch (error) {
    console.error('Error getting whitelisted paths toggle state:', error);
    return {};
  }
}

/**
 * Save whitelisted paths toggle state
 */
export async function saveWhitelistedPathsToggleState(toggleState: SiteToggleState): Promise<void> {
  try {
    await setStorageData({ [STORAGE_KEYS.WHITELISTED_PATHS_TOGGLE_STATE]: toggleState });
  } catch (error) {
    console.error('Error saving whitelisted paths toggle state:', error);
    throw error;
  }
}

/**
 * Toggle whitelisted path enabled/disabled state
 */
export async function toggleWhitelistedPath(path: string): Promise<boolean> {
  try {
    const toggleState = await getWhitelistedPathsToggleState();
    const newState = !(toggleState[path] ?? true); // Default to enabled if not set
    toggleState[path] = newState;
    await saveWhitelistedPathsToggleState(toggleState);
    return newState;
  } catch (error) {
    console.error('Error toggling whitelisted path:', error);
    throw error;
  }
}

/**
 * Check if blocked site is enabled
 */
export async function isBlockedSiteEnabled(website: string): Promise<boolean> {
  try {
    const toggleState = await getBlockedSitesToggleState();
    return toggleState[website] ?? true; // Default to enabled if not set
  } catch (error) {
    console.error('Error checking if blocked site is enabled:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Check if whitelisted path is enabled
 */
export async function isWhitelistedPathEnabled(path: string): Promise<boolean> {
  try {
    const toggleState = await getWhitelistedPathsToggleState();
    return toggleState[path] ?? true; // Default to enabled if not set
  } catch (error) {
    console.error('Error checking if whitelisted path is enabled:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Listen for storage changes
 */
export function onStorageChanged(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
): void {
  chrome.storage.onChanged.addListener(callback);
}