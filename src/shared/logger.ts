import { DebugLogEntry } from './types';
import { DEBUG_CONFIG } from './constants';

export class Logger {
  private logs: DebugLogEntry[] = [];
  private debugEnabled: boolean = false;
  private debugDiv: HTMLElement | null = null;

  constructor(debugEnabled: boolean = false) {
    this.debugEnabled = debugEnabled;
  }

  /**
   * Set debug enabled state
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (!enabled && this.debugDiv) {
      this.debugDiv.remove();
      this.debugDiv = null;
    }
  }

  /**
   * Log a message with optional data
   */
  log(message: string, data?: any): void {
    const entry: DebugLogEntry = {
      timestamp: new Date(),
      message,
      data
    };

    // Always log to console
    // logger.log(`[PomoBlock Debug] ${message}`, data || '');

    // Add to internal log
    this.logs.push(entry);
    if (this.logs.length > DEBUG_CONFIG.MAX_LOG_ENTRIES) {
      this.logs.shift();
    }

    // Show visual debug if enabled
    if (this.debugEnabled) {
      this.showVisualLog(entry);
    }
  }

  /**
   * Show visual debug information on the page
   */
  private showVisualLog(entry: DebugLogEntry): void {
    if (!this.debugDiv) {
      this.debugDiv = this.createDebugDiv();
    }

    const logElement = document.createElement('div');
    logElement.style.cssText = `
      margin: 2px 0; 
      font-size: 12px; 
      color: #fff; 
      background: rgba(0,0,0,0.7); 
      padding: 2px 5px; 
      border-radius: 3px; 
      word-wrap: break-word; 
      overflow-wrap: break-word; 
      white-space: pre-wrap;
    `;
    logElement.textContent = `${entry.timestamp.toLocaleTimeString()}: ${entry.message} ${
      entry.data ? JSON.stringify(entry.data) : ''
    }`;

    this.debugDiv.appendChild(logElement);

    // Keep only last entries
    while (this.debugDiv.children.length > DEBUG_CONFIG.MAX_LOG_ENTRIES + 1) {
      // +1 because we have the title div
      this.debugDiv.removeChild(this.debugDiv.children[1]); // Remove first log entry (keep title)
    }
  }

  /**
   * Create the debug overlay div
   */
  private createDebugDiv(): HTMLElement {
    const debugDiv = document.createElement('div');
    debugDiv.id = DEBUG_CONFIG.DEBUG_DIV_ID;
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

    // Add title
    const title = document.createElement('div');
    title.textContent = 'PomoBlock Debug';
    title.style.cssText = `
      font-weight: bold; 
      margin-bottom: 5px; 
      text-align: center; 
      border-bottom: 1px solid rgba(255,255,255,0.3); 
      padding-bottom: 3px;
    `;
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
    closeButton.addEventListener('click', () => {
      debugDiv.remove();
      this.debugDiv = null;
    });
    debugDiv.appendChild(closeButton);

    document.documentElement.appendChild(debugDiv);
    return debugDiv;
  }

  /**
   * Get all logged entries
   */
  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (this.debugDiv) {
      // Remove all log entries except title and close button
      while (this.debugDiv.children.length > 2) {
        this.debugDiv.removeChild(this.debugDiv.children[2]);
      }
    }
  }
}

// Export a default logger instance
export const logger = new Logger();