import { DebugLogEntry, LogLevel, LogCategory } from './types';
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
  
  // Filter settings
  private levelFilter: Set<LogLevel> = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']);
  private categoryFilter: Set<LogCategory> = new Set(['BLOCKING', 'AUDIO', 'TIMER', 'NAVIGATION', 'STORAGE', 'NETWORK', 'UI', 'SYSTEM', 'GENERAL']);

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
   * Log a message with optional data, level, and category
   */
  log(message: string, data?: any, level: LogLevel = 'INFO', category: LogCategory = 'GENERAL'): void {
    const entry: DebugLogEntry = {
      timestamp: new Date(),
      message,
      level,
      category,
      data
    };

    // Always log to console
    // console.log(`[PomoBlock Debug] ${message}`, data || '');

    // Add to internal log
    this.logs.push(entry);

    // Show visual debug if enabled and we're not in a service worker
    if (this.debugEnabled && !this.isServiceWorker) {
      this.showVisualLog(entry);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  debug(message: string, data?: any, category: LogCategory = 'GENERAL'): void {
    this.log(message, data, 'DEBUG', category);
  }

  info(message: string, data?: any, category: LogCategory = 'GENERAL'): void {
    this.log(message, data, 'INFO', category);
  }

  warn(message: string, data?: any, category: LogCategory = 'GENERAL'): void {
    this.log(message, data, 'WARN', category);
  }

  error(message: string, data?: any, category: LogCategory = 'GENERAL'): void {
    this.log(message, data, 'ERROR', category);
  }

  /**
   * Check if log entry should be shown based on filters
   */
  private shouldShowLog(entry: DebugLogEntry): boolean {
    return this.levelFilter.has(entry.level) && this.categoryFilter.has(entry.category);
  }

  /**
   * Show visual debug information on the page (only works in content scripts/popup)
   */
  private showVisualLog(entry: DebugLogEntry): void {
    // Skip if we're in a service worker context
    if (this.isServiceWorker) {
      return;
    }

    // Skip if filtered out
    if (!this.shouldShowLog(entry)) {
      return;
    }

    try {
      if (!this.debugDiv) {
        this.debugDiv = this.createDebugDiv();
      }

      // Ensure the logger stays on top by re-appending to DOM
      this.ensureOnTop();

      // Find the log container within the shadow root
      const logContainer = this.shadowRoot?.querySelector('.log-container') as HTMLElement;
      if (logContainer) {
        this.renderLogEntry(entry, logContainer);
        
        // Auto-scroll to bottom to show newest logs
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    } catch (error) {
      // Silently fail if DOM operations aren't available
      console.warn('Could not show visual debug log:', error);
    }
  }

  /**
   * Get color for log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case 'DEBUG': return '#888';
      case 'INFO': return '#4CAF50';
      case 'WARN': return '#FF9800';
      case 'ERROR': return '#f44336';
      default: return '#fff';
    }
  }

  /**
   * Get category badge HTML
   */
  private getCategoryBadge(category: LogCategory): string {
    const colors: { [key in LogCategory]: string } = {
      'BLOCKING': '#f44336',
      'AUDIO': '#9C27B0', 
      'TIMER': '#2196F3',
      'NAVIGATION': '#FF9800',
      'STORAGE': '#4CAF50',
      'NETWORK': '#00BCD4',
      'UI': '#E91E63',
      'SYSTEM': '#607D8B',
      'GENERAL': '#757575'
    };
    
    return `<span style="background: ${colors[category]}; color: white; padding: 1px 4px; border-radius: 2px; font-size: 9px; margin-right: 4px;">${category}</span>`;
  }

  /**
   * Ensure the logger stays on top of other elements
   */
  private ensureOnTop(): void {
    if (this.shadowHost && document.documentElement.contains(this.shadowHost)) {
      // Re-append to ensure it's the last element (highest in stacking order)
      document.documentElement.removeChild(this.shadowHost);
      document.documentElement.appendChild(this.shadowHost);
      
      // Also ensure z-index is at maximum
      this.shadowHost.style.zIndex = '2147483647';
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
    clearButton.addEventListener('click', () => {
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
    });

    // Filter button
    const filterButton = document.createElement('button');
    filterButton.textContent = '🔽';
    filterButton.title = 'Toggle filters';
    filterButton.style.cssText = this.getButtonStyles();
    filterButton.addEventListener('click', () => {
      const filtersContainer = this.shadowRoot?.querySelector('.filters-container') as HTMLElement;
      if (filtersContainer) {
        const isVisible = filtersContainer.style.display !== 'none';
        filtersContainer.style.display = isVisible ? 'none' : 'block';
        filterButton.textContent = isVisible ? '🔽' : '🔼';
      }
    });

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.title = 'Close debug panel';
    closeButton.style.cssText = this.getButtonStyles();
    closeButton.addEventListener('click', () => {
      this.setDebugEnabled(false);
    });

    controls.appendChild(filterButton);
    controls.appendChild(clearButton);
    controls.appendChild(closeButton);
    header.appendChild(title);
    header.appendChild(controls);

    // Create filters container
    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'filters-container';
    filtersContainer.style.cssText = `
      display: none;
      background: rgba(0,0,0,0.3);
      padding: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.2);
      font-size: 10px;
    `;
    
    filtersContainer.innerHTML = this.createFiltersHTML();
    this.setupFilterEventListeners(filtersContainer);

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
    debugDiv.appendChild(filtersContainer);
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
      width: Math.max(250, Math.min(800, e.clientX - rect.left)),
      height: Math.max(200, e.clientY - rect.top)
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
   * Get all logged entries (for testing purposes)
   */
  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs (for testing purposes)
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Create filters HTML
   */
  private createFiltersHTML(): string {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const categories: LogCategory[] = ['BLOCKING', 'AUDIO', 'TIMER', 'NAVIGATION', 'STORAGE', 'NETWORK', 'UI', 'SYSTEM', 'GENERAL'];
    
    const levelCheckboxes = levels.map(level => {
      const checked = this.levelFilter.has(level) ? 'checked' : '';
      const color = this.getLevelColor(level);
      return `
        <label style="margin-right: 8px; display: inline-block; cursor: pointer;">
          <input type="checkbox" ${checked} data-filter-type="level" data-filter-value="${level}" style="margin-right: 2px;">
          <span style="color: ${color}; font-weight: bold;">${level}</span>
        </label>
      `;
    }).join('');
    
    const categoryCheckboxes = categories.map(category => {
      const checked = this.categoryFilter.has(category) ? 'checked' : '';
      const badge = this.getCategoryBadge(category);
      return `
        <label style="margin-right: 6px; display: inline-block; cursor: pointer; margin-bottom: 4px;">
          <input type="checkbox" ${checked} data-filter-type="category" data-filter-value="${category}" style="margin-right: 4px;">
          ${badge}
        </label>
      `;
    }).join('');
    
    return `
      <div style="margin-bottom: 6px;">
        <strong style="color: #fff; display: block; margin-bottom: 4px;">Log Levels:</strong>
        ${levelCheckboxes}
      </div>
      <div>
        <strong style="color: #fff; display: block; margin-bottom: 4px;">Categories:</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 2px;">
          ${categoryCheckboxes}
        </div>
      </div>
    `;
  }

  /**
   * Setup filter event listeners
   */
  private setupFilterEventListeners(filtersContainer: HTMLElement): void {
    const checkboxes = filtersContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const filterType = target.getAttribute('data-filter-type') as 'level' | 'category';
        const filterValue = target.getAttribute('data-filter-value')!;
        
        if (filterType === 'level') {
          const level = filterValue as LogLevel;
          if (target.checked) {
            this.levelFilter.add(level);
          } else {
            this.levelFilter.delete(level);
          }
        } else if (filterType === 'category') {
          const category = filterValue as LogCategory;
          if (target.checked) {
            this.categoryFilter.add(category);
          } else {
            this.categoryFilter.delete(category);
          }
        }
        
        // Refresh the log display
        this.refreshLogDisplay();
      });
    });
  }

  /**
   * Refresh the log display based on current filters
   */
  private refreshLogDisplay(): void {
    if (!this.shadowRoot || this.isServiceWorker) {
      return;
    }
    
    const logContainer = this.shadowRoot.querySelector('.log-container') as HTMLElement;
    if (!logContainer) {
      return;
    }
    
    // Clear current display
    while (logContainer.firstChild) {
      logContainer.removeChild(logContainer.firstChild);
    }
    
    // Re-render filtered logs
    this.logs.forEach(entry => {
      if (this.shouldShowLog(entry)) {
        this.renderLogEntry(entry, logContainer);
      }
    });
    
    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  /**
   * Render a single log entry to the container
   */
  private renderLogEntry(entry: DebugLogEntry, container: HTMLElement): void {
    const logElement = document.createElement('div');
    const levelColor = this.getLevelColor(entry.level);
    const categoryBadge = this.getCategoryBadge(entry.category);
    
    logElement.style.cssText = `
      margin: 1px 0; 
      font-size: 11px; 
      color: #fff; 
      background: rgba(0,0,0,0.8); 
      padding: 2px 4px; 
      border-radius: 2px; 
      word-wrap: break-word; 
      overflow-wrap: break-word; 
      white-space: pre-wrap;
      border-left: 2px solid ${levelColor};
    `;
    
    const timeStr = entry.timestamp.toLocaleTimeString();
    const dataStr = entry.data ? JSON.stringify(entry.data) : '';
    
    logElement.innerHTML = `
      <span style="color: #888; font-size: 10px;">${timeStr}</span> 
      ${categoryBadge} 
      <span style="color: ${levelColor}; font-weight: bold; font-size: 10px;">[${entry.level}]</span> 
      <span style="color: #fff;">${entry.message}</span>
      ${dataStr ? `<div style="color: #aaa; font-size: 10px; margin-top: 1px; padding-left: 8px;">${dataStr}</div>` : ''}
    `;
    
    container.appendChild(logElement);
  }
}

// Export a default logger instance
export const logger = new Logger();