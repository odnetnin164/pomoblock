/**
 * Chrome storage utilities with consistent interface and error handling
 */

import { DEFAULT_SETTINGS } from '../config/defaults.js';

/**
 * Get data from Chrome storage
 * @param {string|Array|Object} keys - Keys to retrieve
 * @returns {Promise<Object>} Retrieved data
 */
export function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Set data in Chrome storage
 * @param {Object} data - Data to store
 * @returns {Promise<void>}
 */
export function setStorage(data) {
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
 * Remove data from Chrome storage
 * @param {string|Array} keys - Keys to remove
 * @returns {Promise<void>}
 */
export function removeStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clear all data from Chrome storage
 * @returns {Promise<void>}
 */
export function clearStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get extension settings with defaults
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  try {
    const data = await getStorage([
      'blockMode', 'redirectUrl', 'redirectDelay', 
      'extensionEnabled', 'debugEnabled'
    ]);
    
    return {
      blockMode: data.blockMode || DEFAULT_SETTINGS.blockMode,
      redirectUrl: data.redirectUrl || DEFAULT_SETTINGS.redirectUrl,
      redirectDelay: data.redirectDelay !== undefined ? data.redirectDelay : DEFAULT_SETTINGS.redirectDelay,
      extensionEnabled: data.extensionEnabled !== undefined ? data.extensionEnabled : DEFAULT_SETTINGS.extensionEnabled,
      debugEnabled: data.debugEnabled !== undefined ? data.debugEnabled : DEFAULT_SETTINGS.debugEnabled
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save extension settings
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  return setStorage(settings);
}

/**
 * Get blocked websites array
 * @returns {Promise<Array>} Array of blocked websites
 */
export async function getBlockedWebsites() {
  try {
    const data = await getStorage('blockedWebsitesArray');
    return data.blockedWebsitesArray || [];
  } catch (error) {
    console.error('Error loading blocked websites:', error);
    return [];
  }
}

/**
 * Save blocked websites array
 * @param {Array} websites - Array of websites to block
 * @returns {Promise<void>}
 */
export async function saveBlockedWebsites(websites) {
  return setStorage({ blockedWebsitesArray: websites });
}

/**
 * Add a website to the blocked list
 * @param {string} website - Website to add
 * @returns {Promise<Array>} Updated blocked websites array
 */
export async function addBlockedWebsite(website) {
  const websites = await getBlockedWebsites();
  if (!websites.includes(website)) {
    websites.push(website);
    await saveBlockedWebsites(websites);
  }
  return websites;
}

/**
 * Remove a website from the blocked list
 * @param {string} website - Website to remove
 * @returns {Promise<Array>} Updated blocked websites array
 */
export async function removeBlockedWebsite(website) {
  const websites = await getBlockedWebsites();
  const updated = websites.filter(site => site !== website);
  await saveBlockedWebsites(updated);
  return updated;
}

/**
 * Get whitelisted paths array
 * @returns {Promise<Array>} Array of whitelisted paths
 */
export async function getWhitelistedPaths() {
  try {
    const data = await getStorage('whitelistedPathsArray');
    return data.whitelistedPathsArray || [];
  } catch (error) {
    console.error('Error loading whitelisted paths:', error);
    return [];
  }
}

/**
 * Save whitelisted paths array
 * @param {Array} paths - Array of paths to whitelist
 * @returns {Promise<void>}
 */
export async function saveWhitelistedPaths(paths) {
  return setStorage({ whitelistedPathsArray: paths });
}

/**
 * Add a path to the whitelist
 * @param {string} path - Path to add
 * @returns {Promise<Array>} Updated whitelisted paths array
 */
export async function addWhitelistedPath(path) {
  const paths = await getWhitelistedPaths();
  if (!paths.includes(path)) {
    paths.push(path);
    await saveWhitelistedPaths(paths);
  }
  return paths;
}

/**
 * Remove a path from the whitelist
 * @param {string} path - Path to remove
 * @returns {Promise<Array>} Updated whitelisted paths array
 */
export async function removeWhitelistedPath(path) {
  const paths = await getWhitelistedPaths();
  const updated = paths.filter(p => p !== path);
  await saveWhitelistedPaths(updated);
  return updated;
}

/**
 * Listen for storage changes
 * @param {Function} callback - Callback function to handle changes
 */
export function onStorageChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      callback(changes);
    }
  });
}