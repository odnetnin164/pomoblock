import { ExtensionSettings, StorageData, WorkHours } from './types';
import { DEFAULT_SETTINGS, DEFAULT_WORK_HOURS, STORAGE_KEYS } from './constants';

/**
 * Get data from Chrome storage with type safety
 */
export async function getStorageData<T extends keyof StorageData>(
  keys: T | T[]
): Promise<Pick<StorageData, T>> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (data) => {
      resolve(data as Pick<StorageData, T>);
    });
  });
}

/**
 * Set data in Chrome storage
 */
export async function setStorageData(data: Partial<StorageData>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get work hours settings with defaults
 */
export async function getWorkHours(): Promise<WorkHours> {
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
}

/**
 * Save work hours settings
 */
export async function saveWorkHours(workHours: WorkHours): Promise<void> {
  const dataToSave: Partial<StorageData> = {
    workHoursEnabled: workHours.enabled,
    workHoursStartTime: workHours.startTime,
    workHoursEndTime: workHours.endTime,
    workHoursDays: workHours.days
  };

  await setStorageData(dataToSave);
}

/**
 * Get extension settings with defaults
 */
export async function getSettings(): Promise<ExtensionSettings> {
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
}

/**
 * Save extension settings
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
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
}

/**
 * Get blocked websites list
 */
export async function getBlockedWebsites(): Promise<string[]> {
  const data = await getStorageData(STORAGE_KEYS.BLOCKED_WEBSITES);
  return data.blockedWebsitesArray ?? [];
}

/**
 * Save blocked websites list
 */
export async function saveBlockedWebsites(websites: string[]): Promise<void> {
  await setStorageData({ [STORAGE_KEYS.BLOCKED_WEBSITES]: websites });
}

/**
 * Add website to blocked list
 */
export async function addBlockedWebsite(website: string): Promise<string[]> {
  const currentWebsites = await getBlockedWebsites();
  if (!currentWebsites.includes(website)) {
    currentWebsites.push(website);
    await saveBlockedWebsites(currentWebsites);
  }
  return currentWebsites;
}

/**
 * Remove website from blocked list
 */
export async function removeBlockedWebsite(website: string): Promise<string[]> {
  const currentWebsites = await getBlockedWebsites();
  const updatedWebsites = currentWebsites.filter(site => site !== website);
  await saveBlockedWebsites(updatedWebsites);
  return updatedWebsites;
}

/**
 * Get whitelisted paths list
 */
export async function getWhitelistedPaths(): Promise<string[]> {
  const data = await getStorageData(STORAGE_KEYS.WHITELISTED_PATHS);
  return data.whitelistedPathsArray ?? [];
}

/**
 * Save whitelisted paths list
 */
export async function saveWhitelistedPaths(paths: string[]): Promise<void> {
  await setStorageData({ [STORAGE_KEYS.WHITELISTED_PATHS]: paths });
}

/**
 * Add path to whitelist
 */
export async function addWhitelistedPath(path: string): Promise<string[]> {
  const currentPaths = await getWhitelistedPaths();
  if (!currentPaths.includes(path)) {
    currentPaths.push(path);
    await saveWhitelistedPaths(currentPaths);
  }
  return currentPaths;
}

/**
 * Remove path from whitelist
 */
export async function removeWhitelistedPath(path: string): Promise<string[]> {
  const currentPaths = await getWhitelistedPaths();
  const updatedPaths = currentPaths.filter(p => p !== path);
  await saveWhitelistedPaths(updatedPaths);
  return updatedPaths;
}

/**
 * Clear all blocked websites
 */
export async function clearAllBlockedWebsites(): Promise<void> {
  await saveBlockedWebsites([]);
}

/**
 * Clear all whitelisted paths
 */
export async function clearAllWhitelistedPaths(): Promise<void> {
  await saveWhitelistedPaths([]);
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  await saveSettings(DEFAULT_SETTINGS);
}

/**
 * Listen for storage changes
 */
export function onStorageChanged(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
): void {
  chrome.storage.onChanged.addListener(callback);
}