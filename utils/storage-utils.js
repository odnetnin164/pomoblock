// Storage utilities for the PomoBlock extension
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

/**
 * Get extension settings from storage
 */
export function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      STORAGE_KEYS.BLOCK_MODE,
      STORAGE_KEYS.REDIRECT_URL,
      STORAGE_KEYS.REDIRECT_DELAY,
      STORAGE_KEYS.EXTENSION_ENABLED,
      STORAGE_KEYS.DEBUG_ENABLED
    ], function(data) {
      const settings = {
        blockMode: data[STORAGE_KEYS.BLOCK_MODE] || DEFAULT_SETTINGS.blockMode,
        redirectUrl: data[STORAGE_KEYS.REDIRECT_URL] || DEFAULT_SETTINGS.redirectUrl,
        redirectDelay: data[STORAGE_KEYS.REDIRECT_DELAY] !== undefined ? data[STORAGE_KEYS.REDIRECT_DELAY] : DEFAULT_SETTINGS.redirectDelay,
        extensionEnabled: data[STORAGE_KEYS.EXTENSION_ENABLED] !== undefined ? data[STORAGE_KEYS.EXTENSION_ENABLED] : DEFAULT_SETTINGS.extensionEnabled,
        debugEnabled: data[STORAGE_KEYS.DEBUG_ENABLED] !== undefined ? data[STORAGE_KEYS.DEBUG_ENABLED] : DEFAULT_SETTINGS.debugEnabled
      };
      resolve(settings);
    });
  });
}

/**
 * Save extension settings to storage
 */
export function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get blocked websites from storage
 */
export function getBlockedWebsites() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.BLOCKED_WEBSITES, function(data) {
      resolve(data[STORAGE_KEYS.BLOCKED_WEBSITES] || []);
    });
  });
}

/**
 * Save blocked websites to storage
 */
export function saveBlockedWebsites(websites) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({
      [STORAGE_KEYS.BLOCKED_WEBSITES]: websites
    }, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Add a website to the blocked list
 */
export async function addBlockedWebsite(website) {
  const blockedWebsites = await getBlockedWebsites();
  if (!blockedWebsites.includes(website)) {
    blockedWebsites.push(website);
    await saveBlockedWebsites(blockedWebsites);
  }
  return blockedWebsites;
}

/**
 * Remove a website from the blocked list
 */
export async function removeBlockedWebsite(website) {
  const blockedWebsites = await getBlockedWebsites();
  const updatedWebsites = blockedWebsites.filter(site => site !== website);
  await saveBlockedWebsites(updatedWebsites);
  return updatedWebsites;
}

/**
 * Get whitelisted paths from storage
 */
export function getWhitelistedPaths() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.WHITELISTED_PATHS, function(data) {
      resolve(data[STORAGE_KEYS.WHITELISTED_PATHS] || []);
    });
  });
}

/**
 * Save whitelisted paths to storage
 */
export function saveWhitelistedPaths(paths) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({
      [STORAGE_KEYS.WHITELISTED_PATHS]: paths
    }, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Add a path to the whitelist
 */
export async function addWhitelistedPath(path) {
  const whitelistedPaths = await getWhitelistedPaths();
  if (!whitelistedPaths.includes(path)) {
    whitelistedPaths.push(path);
    await saveWhitelistedPaths(whitelistedPaths);
  }
  return whitelistedPaths;
}

/**
 * Remove a path from the whitelist
 */
export async function removeWhitelistedPath(path) {
  const whitelistedPaths = await getWhitelistedPaths();
  const updatedPaths = whitelistedPaths.filter(p => p !== path);
  await saveWhitelistedPaths(updatedPaths);
  return updatedPaths;
}

/**
 * Get all extension data (settings, blocked sites, whitelist)
 */
export async function getAllData() {
  const [settings, blockedWebsites, whitelistedPaths] = await Promise.all([
    getSettings(),
    getBlockedWebsites(),
    getWhitelistedPaths()
  ]);
  
  return {
    settings,
    blockedWebsites,
    whitelistedPaths
  };
}

/**
 * Clear all blocked websites
 */
export function clearAllBlockedWebsites() {
  return saveBlockedWebsites([]);
}

/**
 * Clear all whitelisted paths
 */
export function clearAllWhitelistedPaths() {
  return saveWhitelistedPaths([]);
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}