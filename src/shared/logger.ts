import { DebugLogEntry } from './types';
import { DEBUG_CONFIG } from './constants';

export class Logger {
  private logs: DebugLogEntry[] = [];
  private debugEnabled: boolean = false;
  private debugDiv: HTMLElement | null = null;
  private shadowHost: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private isServiceWorker: boolean = false;
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private currentPosition: { x: number; y: number } = { x: 10, y: 10 };
  private currentSize: { width: number; height: number } = { width: 400, height: 500 };

  constructor(debugEnabled: boolean = false) {
    this.debugEnabled = debugEnabled;
    
    // Detect if we're running in a service worker context
    this.isServiceWorker = typeof window === 'undefined' && typeof document === 'undefined';
  }

  /**
   * Set debug enabled state
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (!enabled && this.shadowHost && !this.isServiceWorker) {
      this.shadowHost.remove();
      this.shadowHost = null;
      this.shadowRoot = null;
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
    // console.log(`[PomoBlock Debug] ${message}`, data || '');

    // Add to internal log
    this.logs.push(entry);
    if (this.logs.length > DEBUG_CONFIG.MAX_LOG_ENTRIES) {
      this.logs.shift();
    }

    // Show visual debug if enabled and we're not in a service worker
    if (this.debugEnabled && !this.isServiceWorker) {
      this.showVisualLog(entry);
    }
  }

  /**
   * Show visual debug information on the page (only works in content scripts/popup)
   */
  private showVisualLog(entry: DebugLogEntry): void {
    // Skip if we're in a service worker context
    if (this.isServiceWorker) {
      return;
    }

    try {
      if (!this.debugDiv) {
        this.debugDiv = this.createDebugDiv();
      }

      // Ensure the logger stays on top by re-appending to DOM
      this.ensureOnTop();

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

      // Find the log container within the shadow root
      const logContainer = this.shadowRoot?.querySelector('.log-container') as HTMLElement;
      if (logContainer) {
        logContainer.appendChild(logElement);

        // Keep only last entries
        while (logContainer.children.length > DEBUG_CONFIG.MAX_LOG_ENTRIES) {
          logContainer.removeChild(logContainer.children[0]);
        }
      }
    } catch (error) {
      // Silently fail if DOM operations aren't available
      console.warn('Could not show visual debug log:', error);
    }
  }

  /**
   * Ensure the logger stays on top of other elements
   */
  private ensureOnTop(): void {
    if (this.shadowHost && document.documentElement.contains(this.shadowHost)) {
      // Re-append to ensure it's the last element (highest in stacking order)
      document.documentElement.removeChild(this.shadowHost);
      document.documentElement.appendChild(this.shadowHost);
    }
  }

  /**
   * Create the debug overlay div with shadow DOM (only works in content scripts/popup)
   */
  private createDebugDiv(): HTMLElement {
    // This should only be called if we're not in a service worker
    if (this.isServiceWorker) {
      throw new Error('Cannot create debug div in service worker context');
    }

    // Calculate top-right position
    this.currentPosition = {
      x: Math.max(10, window.innerWidth - this.currentSize.width - 10),
      y: 10
    };

    // Create shadow host
    this.shadowHost = document.createElement('div');
    this.shadowHost.id = DEBUG_CONFIG.DEBUG_DIV_ID + '-host';
    this.shadowHost.style.cssText = `
      position: fixed !important;
      top: ${this.currentPosition.y}px !important;
      left: ${this.currentPosition.x}px !important;
      width: ${this.currentSize.width}px !important;
      height: ${this.currentSize.height}px !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    `;

    // Create shadow root
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

    // Create the debug container inside shadow DOM
    const debugDiv = document.createElement('div');
    debugDiv.id = DEBUG_CONFIG.DEBUG_DIV_ID;
    debugDiv.style.cssText = `
      width: 100%;
      height: 100%;
      background: rgba(255, 0, 0, 0.95);
      color: white;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      border: 2px solid #fff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      backdrop-filter: blur(5px);
    `;

    // Create header with title and controls
    const header = document.createElement('div');
    header.style.cssText = `
      background: rgba(0,0,0,0.2);
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
      border-bottom: 1px solid rgba(255,255,255,0.2);
      min-height: 24px;
    `;

    const title = document.createElement('div');
    title.textContent = 'PomoBlock Debug';
    title.style.cssText = `
      font-weight: bold;
      font-size: 12px;
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = '🗑️';
    clearButton.title = 'Clear logs';
    clearButton.style.cssText = this.getButtonStyles();
    clearButton.addEventListener('click', () => this.clearLogs());

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.title = 'Close debug panel';
    closeButton.style.cssText = this.getButtonStyles();
    closeButton.addEventListener('click', () => {
      this.setDebugEnabled(false);
    });

    controls.appendChild(clearButton);
    controls.appendChild(closeButton);
    header.appendChild(title);
    header.appendChild(controls);

    // Create log container with scrolling
    const logContainer = document.createElement('div');
    logContainer.className = 'log-container';
    logContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    `;

    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 12px;
      height: 12px;
      cursor: se-resize;
      background: linear-gradient(-45deg, transparent 30%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.3) 70%, transparent 70%);
    `;

    debugDiv.appendChild(header);
    debugDiv.appendChild(logContainer);
    debugDiv.appendChild(resizeHandle);

    // Add drag functionality
    this.setupDragAndResize(header, resizeHandle);

    // Add styles for scrollbar
    const style = document.createElement('style');
    style.textContent = `
      .log-container::-webkit-scrollbar {
        width: 8px;
      }
      .log-container::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
      }
      .log-container::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.3);
        border-radius: 4px;
      }
      .log-container::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.5);
      }
    `;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(debugDiv);
    document.documentElement.appendChild(this.shadowHost);

    return debugDiv;
  }

  /**
   * Get common button styles
   */
  private getButtonStyles(): string {
    return `
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    `;
  }

  /**
   * Setup drag and resize functionality
   */
  private setupDragAndResize(header: HTMLElement, resizeHandle: HTMLElement): void {
    // Drag functionality
    header.addEventListener('mousedown', (e) => {
      if (e.target === header || header.contains(e.target as Node)) {
        this.isDragging = true;
        this.dragOffset = {
          x: e.clientX - this.currentPosition.x,
          y: e.clientY - this.currentPosition.y
        };
        document.addEventListener('mousemove', this.handleDrag);
        document.addEventListener('mouseup', this.handleDragEnd);
        e.preventDefault();
      }
    });

    // Resize functionality
    resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      document.addEventListener('mousemove', this.handleResize);
      document.addEventListener('mouseup', this.handleResizeEnd);
      e.preventDefault();
      e.stopPropagation();
    });

    // Add hover effects for buttons
    const buttons = header.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        (button as HTMLElement).style.background = 'rgba(255,255,255,0.2)';
      });
      button.addEventListener('mouseleave', () => {
        (button as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
      });
    });
  }

  /**
   * Handle dragging
   */
  private handleDrag = (e: MouseEvent): void => {
    if (!this.isDragging || !this.shadowHost) return;

    this.currentPosition = {
      x: Math.max(0, Math.min(window.innerWidth - this.currentSize.width, e.clientX - this.dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - this.currentSize.height, e.clientY - this.dragOffset.y))
    };

    this.shadowHost.style.left = this.currentPosition.x + 'px';
    this.shadowHost.style.top = this.currentPosition.y + 'px';
  };

  /**
   * Handle drag end
   */
  private handleDragEnd = (): void => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleDrag);
    document.removeEventListener('mouseup', this.handleDragEnd);
  };

  /**
   * Handle resizing
   */
  private handleResize = (e: MouseEvent): void => {
    if (!this.isResizing || !this.shadowHost) return;

    const rect = this.shadowHost.getBoundingClientRect();
    this.currentSize = {
      width: Math.max(250, Math.min(600, e.clientX - rect.left)),
      height: Math.max(200, Math.min(600, e.clientY - rect.top))
    };

    this.shadowHost.style.width = this.currentSize.width + 'px';
    this.shadowHost.style.height = this.currentSize.height + 'px';
  };

  /**
   * Handle resize end
   */
  private handleResizeEnd = (): void => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.handleResizeEnd);
  };

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
    if (this.shadowRoot && !this.isServiceWorker) {
      const logContainer = this.shadowRoot.querySelector('.log-container') as HTMLElement;
      if (logContainer) {
        // Remove all log entries
        while (logContainer.firstChild) {
          logContainer.removeChild(logContainer.firstChild);
        }
      }
    }
  }
}

// Export a default logger instance
export const logger = new Logger();