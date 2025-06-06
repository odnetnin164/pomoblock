// Debug utilities for content script

let debugEnabled = false;

/**
 * Set debug enabled state
 */
export function setDebugEnabled(enabled) {
  debugEnabled = enabled;
}

/**
 * Visual debug function that shows messages on the page
 */
export function debugLog(message, data = null) {
  console.log(`[PomoBlock Debug] ${message}`, data || '');
  
  // Only show visual debug if enabled
  if (!debugEnabled) {
    return;
  }
  
  // Also show debug info visually on the page
  const debugDiv = document.getElementById('siteblocker-debug') || createDebugDiv();
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
 * Create debug overlay div
 */
function createDebugDiv() {
  const debugDiv = document.createElement('div');
  debugDiv.id = 'siteblocker-debug';
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
 * Remove debug div if debug is disabled
 */
export function hideDebugDiv() {
  const existingDebugDiv = document.getElementById('siteblocker-debug');
  if (existingDebugDiv) {
    existingDebugDiv.remove();
  }
}