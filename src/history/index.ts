// src/history/index.ts
// History page for viewing Pomodoro session history

import { getSessionsHistory, getDailyStats, formatDuration, formatDurationLong } from '@shared/pomodoroStorage';
import { PomodoroSession, DailyStats } from '@shared/pomodoroTypes';

class HistoryManager {
  private sessionsContainer: HTMLElement;
  private statsContainer: HTMLElement;
  private dateRangeStart: HTMLInputElement;
  private dateRangeEnd: HTMLInputElement;
  private filterButton: HTMLButtonElement;
  private clearFilterButton: HTMLButtonElement;
  private exportButton: HTMLButtonElement;
  private clearDataButton: HTMLButtonElement;
  private backToOptionsButton: HTMLButtonElement;

  constructor() {
    // Get DOM elements
    this.sessionsContainer = document.getElementById('sessionsContainer')!;
    this.statsContainer = document.getElementById('statsContainer')!;
    this.dateRangeStart = document.getElementById('dateRangeStart') as HTMLInputElement;
    this.dateRangeEnd = document.getElementById('dateRangeEnd') as HTMLInputElement;
    this.filterButton = document.getElementById('filterButton') as HTMLButtonElement;
    this.clearFilterButton = document.getElementById('clearFilterButton') as HTMLButtonElement;
    this.exportButton = document.getElementById('exportButton') as HTMLButtonElement;
    this.clearDataButton = document.getElementById('clearDataButton') as HTMLButtonElement;
    this.backToOptionsButton = document.getElementById('backToOptions') as HTMLButtonElement;

    this.init();
  }

  /**
   * Initialize the history page
   */
  private async init(): Promise<void> {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.dateRangeEnd.value = today.toISOString().split('T')[0];
    this.dateRangeStart.value = thirtyDaysAgo.toISOString().split('T')[0];

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadData();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.filterButton.addEventListener('click', () => this.loadData());
    this.clearFilterButton.addEventListener('click', () => this.clearFilter());
    this.exportButton.addEventListener('click', () => this.exportData());
    this.clearDataButton.addEventListener('click', () => this.clearAllData());
    this.backToOptionsButton.addEventListener('click', () => this.goBackToOptions());
  }

  /**
   * Load data and update display
   */
  private async loadData(): Promise<void> {
    try {
      this.showLoading();
      
      const startDate = this.dateRangeStart.value || undefined;
      const endDate = this.dateRangeEnd.value || undefined;
      
      const sessions = await getSessionsHistory(startDate, endDate);
      
      this.displayStats(sessions);
      this.displaySessions(sessions);
      
    } catch (error) {
      console.error('Error loading history data:', error);
      this.showError('Failed to load history data. Please try again.');
    }
  }

  /**
   * Display loading state
   */
  private showLoading(): void {
    this.sessionsContainer.innerHTML = `
      <div class="loading-state">
        <p>Loading sessions...</p>
      </div>
    `;
  }

  /**
   * Display error state
   */
  private showError(message: string): void {
    this.sessionsContainer.innerHTML = `
      <div class="error-state">
        <p>❌ ${message}</p>
        <button class="retry-btn" onclick="location.reload()">Try Again</button>
      </div>
    `;
  }

  /**
   * Display statistics overview
   */
  private displayStats(sessions: PomodoroSession[]): void {
    const workSessions = sessions.filter(s => s.type === 'WORK');
    const restSessions = sessions.filter(s => s.type === 'REST');
    const completedWorkSessions = workSessions.filter(s => s.completed);
    const completedRestSessions = restSessions.filter(s => s.completed);

    const totalWorkTime = workSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalRestTime = restSessions.reduce((sum, s) => sum + s.duration, 0);
    
    const completionRate = workSessions.length > 0 ? 
      (completedWorkSessions.length / workSessions.length) * 100 : 0;

    this.statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${completedWorkSessions.length}</div>
          <div class="stat-label">Completed Work Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completedRestSessions.length}</div>
          <div class="stat-label">Completed Breaks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatDurationLong(totalWorkTime)}</div>
          <div class="stat-label">Total Work Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatDurationLong(totalRestTime)}</div>
          <div class="stat-label">Total Break Time</div>
        </div>
      </div>
      
      <div class="completion-rate">
        <h3>Completion Rate</h3>
        <div class="completion-bar">
          <div class="completion-fill" style="width: ${completionRate}%"></div>
        </div>
        <div class="completion-text">${Math.round(completionRate)}% of work sessions completed</div>
      </div>
    `;
  }

  /**
   * Display sessions grouped by date
   */
  private displaySessions(sessions: PomodoroSession[]): void {
    if (sessions.length === 0) {
      this.sessionsContainer.innerHTML = `
        <div class="empty-state">
          <p>No sessions found for the selected date range.</p>
          <p>Start a pomodoro session to see it appear here!</p>
        </div>
      `;
      return;
    }

    // Group sessions by date
    const sessionsByDate = this.groupSessionsByDate(sessions);
    
    const sessionsHTML = Object.entries(sessionsByDate)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, dateSessions]) => this.renderDayGroup(date, dateSessions))
      .join('');

    this.sessionsContainer.innerHTML = sessionsHTML;
  }

  /**
   * Group sessions by date
   */
  private groupSessionsByDate(sessions: PomodoroSession[]): { [date: string]: PomodoroSession[] } {
    return sessions.reduce((groups, session) => {
      const date = session.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(session);
      return groups;
    }, {} as { [date: string]: PomodoroSession[] });
  }

  /**
   * Render a day group of sessions
   */
  private renderDayGroup(date: string, sessions: PomodoroSession[]): string {
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const workSessions = sessions.filter(s => s.type === 'WORK');
    const completedWork = workSessions.filter(s => s.completed).length;
    const totalWorkTime = workSessions.reduce((sum, s) => sum + s.duration, 0);

    const sessionsHTML = sessions
      .sort((a, b) => a.startTime - b.startTime)
      .map(session => this.renderSession(session))
      .join('');

    return `
      <div class="day-group">
        <div class="day-header">
          <h3>${formattedDate}</h3>
          <div class="day-summary">
            ${completedWork} work session${completedWork !== 1 ? 's' : ''} completed • 
            ${formatDurationLong(totalWorkTime)} total work time
          </div>
        </div>
        <div class="day-sessions">
          ${sessionsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Render a single session
   */
  private renderSession(session: PomodoroSession): string {
    const startTime = new Date(session.startTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const icon = session.type === 'WORK' ? '🍅' : '☕';
    const typeClass = session.type === 'WORK' ? 'work-session' : 'rest-session';
    const statusClass = session.completed ? '' : 'interrupted';
    const statusIcon = session.completed ? '✅' : '⏹️';
    const statusText = session.completed ? 'Completed' : 'Interrupted';

    return `
      <div class="session-item ${typeClass} ${statusClass}">
        <div class="session-icon">${icon}</div>
        <div class="session-details">
          <div class="session-task">${session.task || `${session.type === 'WORK' ? 'Work' : 'Break'} Session`}</div>
          <div class="session-time">
            ${startTime} • ${formatDurationLong(session.duration)} 
            ${session.duration !== session.plannedDuration ? 
              `(planned: ${formatDurationLong(session.plannedDuration)})` : ''}
          </div>
        </div>
        <div class="session-status">
          <div class="completion-icon">${statusIcon}</div>
          <div class="status-text">${statusText}</div>
        </div>
      </div>
    `;
  }

  /**
   * Clear date filter
   */
  private clearFilter(): void {
    this.dateRangeStart.value = '';
    this.dateRangeEnd.value = '';
    this.loadData();
  }

  /**
   * Export data as JSON
   */
  private async exportData(): Promise<void> {
    try {
      const startDate = this.dateRangeStart.value || undefined;
      const endDate = this.dateRangeEnd.value || undefined;
      const sessions = await getSessionsHistory(startDate, endDate);

      const dataStr = JSON.stringify(sessions, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pomoblock-history-${new Date().toISOString().split('T')[0]}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    }
  }

  /**
   * Clear all history data
   */
  private async clearAllData(): Promise<void> {
    if (!confirm('Are you sure you want to delete ALL pomodoro history? This cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently delete all your session data. Are you absolutely sure?')) {
      return;
    }

    try {
      // Clear all data by setting empty storage
      await chrome.storage.local.set({
        pomodoroDailyStats: {},
        pomodoroSessionsHistory: []
      });

      // Reload the page to show empty state
      location.reload();
      
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Please try again.');
    }
  }

  /**
   * Go back to options page
   */
  private goBackToOptions(): void {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HistoryManager();
});