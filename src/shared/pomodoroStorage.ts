import { PomodoroSettings, TimerStatus, PomodoroSession, DailyStats } from './pomodoroTypes';
import { getStorageData, setStorageData } from './storage';

// Storage Keys for Pomodoro
export const POMODORO_STORAGE_KEYS = {
  SETTINGS: 'pomodoroSettings',
  TIMER_STATUS: 'pomodoroTimerStatus',
  DAILY_STATS: 'pomodoroDailyStats',
  SESSIONS_HISTORY: 'pomodoroSessionsHistory',
  CURRENT_SESSION: 'pomodoroCurrentSession'
} as const;

// Default Pomodoro Settings
export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  restDuration: 5,
  longRestDuration: 15,
  longRestInterval: 4,
  autoStartRest: false,
  autoStartWork: false,
  showNotifications: true,
  playSound: true
};

// Default Timer Status
export const DEFAULT_TIMER_STATUS: TimerStatus = {
  state: 'STOPPED',
  timeRemaining: 0,
  totalTime: 0,
  currentTask: '',
  sessionCount: 0
};

/**
 * Get pomodoro settings
 */
export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.SETTINGS);
    return (data as any)[POMODORO_STORAGE_KEYS.SETTINGS] || DEFAULT_POMODORO_SETTINGS;
  } catch (error) {
    console.error('Error getting pomodoro settings:', error);
    return DEFAULT_POMODORO_SETTINGS;
  }
}

/**
 * Save pomodoro settings
 */
export async function savePomodoroSettings(settings: PomodoroSettings): Promise<void> {
  await setStorageData({ [POMODORO_STORAGE_KEYS.SETTINGS]: settings });
}

/**
 * Get timer status
 */
export async function getTimerStatus(): Promise<TimerStatus> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.TIMER_STATUS);
    return (data as any)[POMODORO_STORAGE_KEYS.TIMER_STATUS] || DEFAULT_TIMER_STATUS;
  } catch (error) {
    console.error('Error getting timer status:', error);
    return DEFAULT_TIMER_STATUS;
  }
}

/**
 * Save timer status
 */
export async function saveTimerStatus(status: TimerStatus): Promise<void> {
  await setStorageData({ [POMODORO_STORAGE_KEYS.TIMER_STATUS]: status });
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get daily stats for a specific date
 */
export async function getDailyStats(date?: string): Promise<DailyStats> {
  const targetDate = date || getTodayDateString();
  
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS);
    const allStats = (data as any)[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    return allStats[targetDate] || {
      date: targetDate,
      completedWorkSessions: 0,
      completedRestSessions: 0,
      totalWorkTime: 0,
      totalRestTime: 0,
      sessions: []
    };
  } catch (error) {
    console.error('Error getting daily stats:', error);
    return {
      date: targetDate,
      completedWorkSessions: 0,
      completedRestSessions: 0,
      totalWorkTime: 0,
      totalRestTime: 0,
      sessions: []
    };
  }
}

/**
 * Save daily stats for a specific date
 */
export async function saveDailyStats(stats: DailyStats): Promise<void> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS);
    const allStats = (data as any)[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    allStats[stats.date] = stats;
    
    await setStorageData({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: allStats });
  } catch (error) {
    console.error('Error saving daily stats:', error);
  }
}

/**
 * Add a completed session to daily stats
 */
export async function addCompletedSession(session: PomodoroSession): Promise<void> {
  const stats = await getDailyStats(session.date);
  
  // Add session to the list
  stats.sessions.push(session);
  
  // Update counters and totals
  if (session.type === 'WORK') {
    if (session.completed) {
      stats.completedWorkSessions++;
    }
    stats.totalWorkTime += session.duration;
  } else {
    if (session.completed) {
      stats.completedRestSessions++;
    }
    stats.totalRestTime += session.duration;
  }
  
  await saveDailyStats(stats);
}

/**
 * Get sessions history for a date range
 */
export async function getSessionsHistory(startDate?: string, endDate?: string): Promise<PomodoroSession[]> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS);
    const allStats = (data as any)[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    let sessions: PomodoroSession[] = [];
    
    // If no date range specified, get all sessions
    if (!startDate && !endDate) {
      Object.values(allStats).forEach((dayStats: any) => {
        sessions.push(...dayStats.sessions);
      });
    } else {
      // Filter by date range
      const start = startDate ? new Date(startDate) : new Date('1970-01-01');
      const end = endDate ? new Date(endDate) : new Date();
      
      Object.entries(allStats).forEach(([date, dayStats]: [string, any]) => {
        const dateObj = new Date(date);
        if (dateObj >= start && dateObj <= end) {
          sessions.push(...dayStats.sessions);
        }
      });
    }
    
    // Sort by start time (most recent first)
    return sessions.sort((a, b) => b.startTime - a.startTime);
  } catch (error) {
    console.error('Error getting sessions history:', error);
    return [];
  }
}

/**
 * Get current session in progress
 */
export async function getCurrentSession(): Promise<PomodoroSession | null> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.CURRENT_SESSION);
    return (data as any)[POMODORO_STORAGE_KEYS.CURRENT_SESSION] || null;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

/**
 * Save current session in progress
 */
export async function saveCurrentSession(session: PomodoroSession | null): Promise<void> {
  await setStorageData({ [POMODORO_STORAGE_KEYS.CURRENT_SESSION]: session });
}

/**
 * Clear old session data (keep only last 90 days)
 */
export async function cleanupOldData(): Promise<void> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS);
    const allStats = (data as any)[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const filteredStats: { [key: string]: DailyStats } = {};
    
    Object.entries(allStats).forEach(([date, stats]) => {
      const dateObj = new Date(date);
      if (dateObj >= cutoffDate) {
        filteredStats[date] = stats as DailyStats;
      }
    });
    
    await setStorageData({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: filteredStats });
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format duration in minutes and seconds
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in human readable format
 */
export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}