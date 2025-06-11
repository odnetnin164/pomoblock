// src/history/index.ts
// History page for viewing Pomodoro session history

import './history.css';
import { getSessionsHistory, getDailyStats, formatDuration, formatDurationLong } from '@shared/pomodoroStorage';
import { PomodoroSession, DailyStats } from '@shared/pomodoroTypes';

class HistoryManager {
  private sessionsContainer: HTMLElement;
  private statsContainer: HTMLElement;
  private clearDataButton: HTMLButtonElement;

  constructor() {
    // Get DOM elements
    this.sessionsContainer = document.getElementById('sessionsContainer')!;
    this.statsContainer = document.getElementById('statsContainer')!;
    this.clearDataButton = document.getElementById('clearDataButton') as HTMLButtonElement;

    this.init();
  }

  /**
   * Initialize the history page
   */
  private async init(): Promise<void> {
    // Setup event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadData();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.clearDataButton.addEventListener('click', () => this.clearAllData());
  }

  /**
   * Load data and update display
   */
  private async loadData(): Promise<void> {
    try {
      this.showLoading();
      
      const sessions = await getSessionsHistory();
      
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
      <div class="stat-card">
        <h3>Work Sessions</h3>
        <div class="stat-value">${completedWorkSessions.length}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <h3>Break Sessions</h3>
        <div class="stat-value">${completedRestSessions.length}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <h3>Total Work Time</h3>
        <div class="stat-value">${formatDurationLong(totalWorkTime)}</div>
        <div class="stat-label">Focused time</div>
      </div>
      <div class="stat-card">
        <h3>Completion Rate</h3>
        <div class="stat-value">${Math.round(completionRate)}%</div>
        <div class="stat-label">Sessions completed</div>
      </div>
    `;
  }

  /**
   * Display sessions
   */
  private displaySessions(sessions: PomodoroSession[]): void {
    if (sessions.length === 0) {
      this.sessionsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍅</div>
          <h3>No sessions yet</h3>
          <p>Start a pomodoro session to see it appear here!</p>
        </div>
      `;
      return;
    }

    // Show the most recent sessions first
    const sortedSessions = sessions
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 50); // Show latest 50 sessions
    
    const sessionsHTML = sortedSessions
      .map(session => this.renderSession(session))
      .join('');

    this.sessionsContainer.innerHTML = sessionsHTML;
  }


  /**
   * Render a single session
   */
  private renderSession(session: PomodoroSession): string {
    const startTime = new Date(session.startTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }) + ' ' + new Date(session.startTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const typeText = session.type === 'WORK' ? 'Work Session' : 'Break';
    const typeClass = session.type === 'WORK' ? 'work' : 'rest';
    const statusText = session.completed ? 'Completed' : 'Interrupted';

    return `
      <div class="session-item">
        <div class="session-info">
          <div class="session-type ${typeClass}">${typeText}</div>
          <div class="session-task">${session.task || 'Focus session'}</div>
        </div>
        <div class="session-details">
          <div class="session-duration">${formatDurationLong(session.duration)}</div>
          <div class="session-date">${startTime} • ${statusText}</div>
        </div>
      </div>
    `;
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

}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HistoryManager();
});