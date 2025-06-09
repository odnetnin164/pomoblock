import { PomodoroSettings, TimerStatus, PomodoroSession, DailyStats } from './pomodoroTypes';
import { logger } from '@shared/logger';

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
 * Get data from Chrome storage with error handling
 */
async function getStorageData(key: string, useLocal: boolean = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const storage = useLocal ? chrome.storage.local : chrome.storage.sync;
    storage.get([key], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Set data in Chrome storage with error handling
 */
async function setStorageData(data: { [key: string]: any }, useLocal: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const storage = useLocal ? chrome.storage.local : chrome.storage.sync;
    storage.set(data, () => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get pomodoro settings with error handling
 */
export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.SETTINGS, false); // Use sync storage for settings
    const settings = data[POMODORO_STORAGE_KEYS.SETTINGS];
    
    if (!settings) {
      logger.log('No pomodoro settings found, using defaults');
      return DEFAULT_POMODORO_SETTINGS;
    }
    
    // Merge with defaults to ensure all properties exist
    return {
      ...DEFAULT_POMODORO_SETTINGS,
      ...settings
    };
  } catch (error) {
    console.error('Error getting pomodoro settings:', error);
    return DEFAULT_POMODORO_SETTINGS;
  }
}

/**
 * Save pomodoro settings with error handling
 */
export async function savePomodoroSettings(settings: PomodoroSettings): Promise<void> {
  try {
    await setStorageData({ [POMODORO_STORAGE_KEYS.SETTINGS]: settings }, false); // Use sync storage for settings
    logger.log('Pomodoro settings saved successfully');
  } catch (error) {
    console.error('Error saving pomodoro settings:', error);
    throw error;
  }
}

/**
 * Get timer status with error handling
 */
export async function getTimerStatus(): Promise<TimerStatus> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.TIMER_STATUS, true); // Use local storage for frequently updated timer status
    const status = data[POMODORO_STORAGE_KEYS.TIMER_STATUS];
    
    if (!status) {
      logger.log('No timer status found, using defaults');
      return DEFAULT_TIMER_STATUS;
    }
    
    // Merge with defaults to ensure all properties exist
    return {
      ...DEFAULT_TIMER_STATUS,
      ...status
    };
  } catch (error) {
    console.error('Error getting timer status:', error);
    return DEFAULT_TIMER_STATUS;
  }
}

/**
 * Save timer status with error handling
 */
export async function saveTimerStatus(status: TimerStatus): Promise<void> {
  try {
    await setStorageData({ [POMODORO_STORAGE_KEYS.TIMER_STATUS]: status }, true); // Use local storage for frequently updated timer status
  } catch (error) {
    console.error('Error saving timer status:', error);
    throw error;
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get daily stats for a specific date with error handling
 */
export async function getDailyStats(date?: string): Promise<DailyStats> {
  const targetDate = date || getTodayDateString();
  
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS, true); // Use local storage for stats
    const allStats = data[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    const dayStats = allStats[targetDate];
    
    if (!dayStats) {
      logger.log(`No daily stats found for ${targetDate} using defaults`);
      return {
        date: targetDate,
        completedWorkSessions: 0,
        completedRestSessions: 0,
        totalWorkTime: 0,
        totalRestTime: 0,
        sessions: []
      };
    }
    
    return dayStats;
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
 * Save daily stats for a specific date with error handling
 */
export async function saveDailyStats(stats: DailyStats): Promise<void> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS, true); // Use local storage for stats
    const allStats = data[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    allStats[stats.date] = stats;
    
    await setStorageData({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: allStats }, true);
    logger.log('Daily stats saved for', stats.date);
  } catch (error) {
    console.error('Error saving daily stats:', error);
    throw error;
  }
}

/**
 * Add a completed session to daily stats with error handling
 */
export async function addCompletedSession(session: PomodoroSession): Promise<void> {
  try {
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
    logger.log(`Session added to daily stats: ${session.type}  ${session.completed ? 'completed' : 'interrupted'}`);
  } catch (error) {
    console.error('Error adding completed session:', error);
    throw error;
  }
}

/**
 * Get sessions history for a date range with error handling
 */
export async function getSessionsHistory(startDate?: string, endDate?: string): Promise<PomodoroSession[]> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS, true);
    const allStats = data[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    let sessions: PomodoroSession[] = [];
    
    // If no date range specified, get all sessions
    if (!startDate && !endDate) {
      Object.values(allStats).forEach((dayStats: any) => {
        if (dayStats && dayStats.sessions) {
          sessions.push(...dayStats.sessions);
        }
      });
    } else {
      // Filter by date range
      const start = startDate ? new Date(startDate) : new Date('1970-01-01');
      const end = endDate ? new Date(endDate) : new Date();
      
      Object.entries(allStats).forEach(([date, dayStats]: [string, any]) => {
        const dateObj = new Date(date);
        if (dateObj >= start && dateObj <= end && dayStats && dayStats.sessions) {
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
 * Get current session in progress with error handling
 */
export async function getCurrentSession(): Promise<PomodoroSession | null> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.CURRENT_SESSION, true);
    const session = data[POMODORO_STORAGE_KEYS.CURRENT_SESSION];
    return session || null;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

/**
 * Save current session in progress with error handling
 */
export async function saveCurrentSession(session: PomodoroSession | null): Promise<void> {
  try {
    await setStorageData({ [POMODORO_STORAGE_KEYS.CURRENT_SESSION]: session }, true);
  } catch (error) {
    console.error('Error saving current session:', error);
    throw error;
  }
}

/**
 * Clear old session data (keep only last 90 days) with error handling
 */
export async function cleanupOldData(): Promise<void> {
  try {
    const data = await getStorageData(POMODORO_STORAGE_KEYS.DAILY_STATS, true);
    const allStats = data[POMODORO_STORAGE_KEYS.DAILY_STATS] || {};
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const filteredStats: { [key: string]: DailyStats } = {};
    
    Object.entries(allStats).forEach(([date, stats]) => {
      const dateObj = new Date(date);
      if (dateObj >= cutoffDate) {
        filteredStats[date] = stats as DailyStats;
      }
    });
    
    await setStorageData({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: filteredStats }, true);
    logger.log('Old data cleanup completed');
  } catch (error) {
    console.error('Error cleaning up old data:', error);
    // Don't throw error - cleanup failure shouldn't break the app
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