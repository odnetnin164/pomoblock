/**
 * Debug utilities for logging and visual debugging
 */

let debugEnabled = false;
let debugDiv = null;

/**
 * Initialize debug system
 * @param {boolean} enabled - Whether debugging is enabled
 */
export function initDebug(enabled = false) {
  debugEnabled = enabled;
  if (!enabled && debugDiv) {
    debugDiv.remove();
    debugDiv = null;
  }
}

/**
 * Log debug message to console and optionally to visual overlay
 * @param {string} message - Debug message
 * @param {*} data - Optional data to log
 * @param {boolean} visualOnly - Only show in visual debug, not console
 */
export function debugLog(message, data = null, visualOnly = false) {
  if (!visualOnly) {
    console.log(`[PomoBlock Debug] ${message}`, data || '');
  }
  
  // Only show visual debug if enabled
  if (!debugEnabled) {
    return;
  }
  
  // Also show debug info visually on the page
  if (!debugDiv) {
    debugDiv = createDebugDiv();
  }
  
  const logEntry = document.createElement('div');
  logEntry.style.cssText = 'margin: 2px 0; font-size: 12px; color: #fff; background: rgba(0,0,0,0.7); padding: 2px 5px; border-radius: 3px; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;';
  logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message} ${data ? JSON.stringify(data) : ''}`;
  debugDiv.appendChild(logEntry);
  
  // Keep only last 10 entries
  while (debugDiv.children.length > 11) { // 11 because we have the title div
    debugDiv.removeChild(debugDiv.children[1]); // Remove first log entry (keep title)
  }
}

/**
 * Create visual debug overlay
 * @returns {HTMLElement} Debug div element
 */
function createDebugDiv() {
  const debugDiv = document.createElement('div');
  debugDiv.id = 'pomoblock-debug';
  debugDiv.style.cssText = `
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    width: 320px !important;
    max-height: 250px !important;
    overflow-y: auto !important;
    background: rgba(255, 0, 0, 0.9) !important;
    color: white !important;
    padding: 10px !important;
    border-radius: 5px !important;
    font-family: monospace !important;
    font-size: 11px !important;
    z-index: 999999 !important;
    border: 2px solid #fff !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  `;
  
  const title = document.createElement('div');
  title.textContent = 'PomoBlock Debug';
  title.style.cssText = 'font-weight: bold; margin-bottom: 5px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 3px;';
  debugDiv.appendChild(title);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute !important;
    top: 5px !important;
    right: 8px !important;
    background: none !important;
    border: none !important;
    color: white !important;
    font-size: 16px !important;
    font-weight: bold !important;
    cursor: pointer !important;
    padding: 0 !important;
    width: 20px !important;
    height: 20px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  closeButton.addEventListener('click', function() {
    debugDiv.remove();
  });
  debugDiv.appendChild(closeButton);
  
  document.documentElement.appendChild(debugDiv);
  return debugDiv;
}

/**
 * Log error with stack trace
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
export function debugError(message, error) {
  console.error(`[PomoBlock Error] ${message}`, error);
  if (debugEnabled) {
    debugLog(`ERROR: ${message}`, error.message, true);
  }
}

/**
 * Log warning
 * @param {string} message - Warning message
 * @param {*} data - Optional data
 */
export function debugWarn(message, data = null) {
  console.warn(`[PomoBlock Warning] ${message}`, data || '');
  if (debugEnabled) {
    debugLog(`WARN: ${message}`, data, true);
  }
}

/**
 * Hide debug overlay
 */
export function hideDebug() {
  if (debugDiv) {
    debugDiv.remove();
    debugDiv = null;
  }
}

/**
 * Check if debug is enabled
 * @returns {boolean} Debug status
 */
export function isDebugEnabled() {
  return debugEnabled;
}