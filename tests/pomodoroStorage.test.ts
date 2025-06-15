import {
  getPomodoroSettings,
  savePomodoroSettings,
  getTimerStatus,
  saveTimerStatus,
  addCompletedSession,
  getCurrentSession,
  saveCurrentSession,
  getDailyStats,
  getSessionsHistory,
  generateSessionId,
  formatDuration,
  POMODORO_STORAGE_KEYS,
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_TIMER_STATUS
} from '@shared/pomodoroStorage';
import { PomodoroSettings, TimerStatus, PomodoroSession } from '@shared/pomodoroTypes';

// Mock logger
jest.mock('@shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

describe('Pomodoro Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.storage.sync.get as jest.Mock).mockClear();
    (chrome.storage.sync.set as jest.Mock).mockClear();
    (chrome.storage.local.get as jest.Mock).mockClear();
    (chrome.storage.local.set as jest.Mock).mockClear();
    delete chrome.runtime.lastError;
  });

  describe('getPomodoroSettings', () => {
    test('should return stored settings', async () => {
      const mockSettings: PomodoroSettings = {
        workDuration: 30,
        restDuration: 10,
        longRestDuration: 20,
        longRestInterval: 3,
        autoStartRest: false,
        autoStartWork: false,
        showNotifications: false,
        playSound: false
      };

      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.SETTINGS]: mockSettings });
      });

      const result = await getPomodoroSettings();

      expect(chrome.storage.sync.get).toHaveBeenCalledWith([POMODORO_STORAGE_KEYS.SETTINGS], expect.any(Function));
      expect(result).toEqual(mockSettings);
    });

    test('should return default settings when none stored', async () => {
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getPomodoroSettings();

      expect(result).toEqual(DEFAULT_POMODORO_SETTINGS);
    });

    test('should merge with defaults for partial settings', async () => {
      const partialSettings = {
        workDuration: 30,
        restDuration: 10
      };

      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.SETTINGS]: partialSettings });
      });

      const result = await getPomodoroSettings();

      expect(result.workDuration).toBe(30);
      expect(result.restDuration).toBe(10);
      expect(result.longRestDuration).toBe(DEFAULT_POMODORO_SETTINGS.longRestDuration);
      expect(result.autoStartRest).toBe(DEFAULT_POMODORO_SETTINGS.autoStartRest);
    });

    test('should return defaults on storage error', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getPomodoroSettings();

      expect(result).toEqual(DEFAULT_POMODORO_SETTINGS);
    });
  });

  describe('savePomodoroSettings', () => {
    test('should save settings to sync storage', async () => {
      const settings: PomodoroSettings = {
        workDuration: 30,
        restDuration: 10,
        longRestDuration: 20,
        longRestInterval: 3,
        autoStartRest: false,
        autoStartWork: false,
        showNotifications: false,
        playSound: false
      };

      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await savePomodoroSettings(settings);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { [POMODORO_STORAGE_KEYS.SETTINGS]: settings },
        expect.any(Function)
      );
    });

    test('should throw error on storage failure', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.sync.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const settings = DEFAULT_POMODORO_SETTINGS;

      await expect(savePomodoroSettings(settings)).rejects.toThrow('Storage error');
    });
  });

  describe('getTimerStatus', () => {
    test('should return stored timer status', async () => {
      const mockStatus: TimerStatus = {
        state: 'WORK',
        timeRemaining: 1200,
        totalTime: 1500,
        currentTask: 'Test task',
        sessionCount: 3,
        nextSessionType: 'REST',
        nextSessionDuration: 300,
        startTime: Date.now()
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.TIMER_STATUS]: mockStatus });
      });

      const result = await getTimerStatus();

      expect(chrome.storage.local.get).toHaveBeenCalledWith([POMODORO_STORAGE_KEYS.TIMER_STATUS], expect.any(Function));
      expect(result).toEqual(mockStatus);
    });

    test('should return default status when none stored', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getTimerStatus();

      expect(result).toEqual(DEFAULT_TIMER_STATUS);
    });

    test('should merge with defaults for partial status', async () => {
      const partialStatus = {
        state: 'WORK' as const,
        timeRemaining: 1200,
        totalTime: 1500
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.TIMER_STATUS]: partialStatus });
      });

      const result = await getTimerStatus();

      expect(result.state).toBe('WORK');
      expect(result.timeRemaining).toBe(1200);
      expect(result.sessionCount).toBe(DEFAULT_TIMER_STATUS.sessionCount);
      expect(result.nextSessionType).toBe(DEFAULT_TIMER_STATUS.nextSessionType);
    });
  });

  describe('saveTimerStatus', () => {
    test('should save timer status to local storage', async () => {
      const status: TimerStatus = {
        state: 'WORK',
        timeRemaining: 1200,
        totalTime: 1500,
        currentTask: 'Test task',
        sessionCount: 3,
        nextSessionType: 'REST',
        nextSessionDuration: 300,
        startTime: Date.now()
      };

      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await saveTimerStatus(status);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [POMODORO_STORAGE_KEYS.TIMER_STATUS]: status },
        expect.any(Function)
      );
    });

    test('should throw error on storage failure', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      const status = DEFAULT_TIMER_STATUS;

      await expect(saveTimerStatus(status)).rejects.toThrow('Storage error');
    });
  });

  describe('getCurrentSession', () => {
    test('should return current session', async () => {
      const mockSession: PomodoroSession = {
        id: 'test-session-id',
        type: 'WORK',
        duration: 900,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: 0,
        completed: false,
        date: '2024-01-15'
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.CURRENT_SESSION]: mockSession });
      });

      const result = await getCurrentSession();

      expect(result).toEqual(mockSession);
    });

    test('should return null when no current session', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });
  });

  describe('saveCurrentSession', () => {
    test('should save current session', async () => {
      const session: PomodoroSession = {
        id: 'test-session-id',
        type: 'WORK',
        duration: 900,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: 0,
        completed: false,
        date: '2024-01-15'
      };

      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await saveCurrentSession(session);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [POMODORO_STORAGE_KEYS.CURRENT_SESSION]: session },
        expect.any(Function)
      );
    });
  });

  describe('saveCurrentSession - clear session functionality', () => {
    test('should clear current session when null is passed', async () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await saveCurrentSession(null);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [POMODORO_STORAGE_KEYS.CURRENT_SESSION]: null },
        expect.any(Function)
      );
    });
  });

  describe('addCompletedSession', () => {
    test('should add session to daily stats and history', async () => {
      const session: PomodoroSession = {
        id: 'test-session-id',
        type: 'WORK',
        duration: 1500,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now() - 1500000,
        endTime: Date.now(),
        completed: true,
        date: '2024-01-15'
      };

      // Mock existing data
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        if (keys.includes(POMODORO_STORAGE_KEYS.DAILY_STATS)) {
          callback({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: {} });
        } else if (keys.includes(POMODORO_STORAGE_KEYS.SESSIONS_HISTORY)) {
          callback({ [POMODORO_STORAGE_KEYS.SESSIONS_HISTORY]: [] });
        } else {
          callback({});
        }
      });

      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await addCompletedSession(session);

      expect(chrome.storage.local.get).toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle storage errors gracefully', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const session: PomodoroSession = {
        id: 'test-session-id',
        type: 'WORK',
        duration: 1500,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: Date.now(),
        completed: true,
        date: '2024-01-15'
      };

      await expect(addCompletedSession(session)).rejects.toThrow('Storage error');
    });
  });

  describe('getDailyStats', () => {
    test('should return daily stats for today', async () => {
      const mockStats = {
        '2024-01-15': {
          completedWorkSessions: 3,
          completedRestSessions: 2,
          totalWorkTime: 4500,
          totalRestTime: 600,
          averageWorkDuration: 1500,
          averageRestDuration: 300
        }
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: mockStats });
      });

      // Mock current date
      const mockDate = new Date('2024-01-15');
      jest.spyOn(global.Date.prototype, 'toISOString').mockReturnValue('2024-01-15T10:00:00.000Z');

      const result = await getDailyStats();

      expect(result).toEqual(mockStats['2024-01-15']);
    });

    test('should return default stats when none found', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getDailyStats();

      expect(result).toEqual({
        date: expect.any(String),
        completedWorkSessions: 0,
        completedRestSessions: 0,
        totalWorkTime: 0,
        totalRestTime: 0,
        sessions: []
      });
    });
  });

  describe('generateSessionId', () => {
    test('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    test('should generate IDs with expected format', () => {
      const id = generateSessionId();
      
      // Should be a string with timestamp and random components
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe('formatDuration', () => {
    test('should format duration in seconds to MM:SS', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3661)).toBe('61:01'); // Over an hour
    });

    test('should handle negative durations', () => {
      expect(formatDuration(-30)).toBe('-1:-30');
    });

    test('should pad single digits with zeros', () => {
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(305)).toBe('5:05');
    });
  });

  describe('getSessionsHistory', () => {
    test('should return sessions history', async () => {
      const mockHistory: PomodoroSession[] = [
        {
          id: 'session-1',
          type: 'WORK',
          duration: 1500,
          plannedDuration: 1500,
          task: 'Task 1',
          startTime: Date.now(),
          endTime: Date.now(),
          completed: true,
          date: '2024-01-15'
        }
      ];

      const mockDailyStats = {
        '2024-01-15': {
          date: '2024-01-15',
          completedWorkSessions: 1,
          completedRestSessions: 0,
          totalWorkTime: 1500,
          totalRestTime: 0,
          sessions: mockHistory
        }
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: mockDailyStats });
      });

      const result = await getSessionsHistory();

      expect(result).toEqual(mockHistory);
    });

    test('should return empty array when no history', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await getSessionsHistory();

      expect(result).toEqual([]);
    });
  });

  describe('formatDurationLong', () => {
    test('should format long durations correctly', () => {
      const { formatDurationLong } = require('@shared/pomodoroStorage');
      
      expect(formatDurationLong(3661)).toBe('1h 1m 1s');
      expect(formatDurationLong(3600)).toBe('1h 0m 0s');
      expect(formatDurationLong(65)).toBe('1m 5s');
      expect(formatDurationLong(30)).toBe('30s');
      expect(formatDurationLong(0)).toBe('0s');
    });
  });

  describe('cleanupOldData', () => {
    test('should remove data older than 90 days', async () => {
      const { cleanupOldData } = require('@shared/pomodoroStorage');
      
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      
      const mockStats = {
        [oldDate.toISOString().split('T')[0]]: {
          date: oldDate.toISOString().split('T')[0],
          completedWorkSessions: 1,
          completedRestSessions: 0,
          totalWorkTime: 1500,
          totalRestTime: 0,
          sessions: []
        },
        [recentDate.toISOString().split('T')[0]]: {
          date: recentDate.toISOString().split('T')[0],
          completedWorkSessions: 2,
          completedRestSessions: 1,
          totalWorkTime: 3000,
          totalRestTime: 300,
          sessions: []
        }
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({ [POMODORO_STORAGE_KEYS.DAILY_STATS]: mockStats });
      });

      (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
        callback();
      });

      await cleanupOldData();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [POMODORO_STORAGE_KEYS.DAILY_STATS]: expect.not.objectContaining({
            [oldDate.toISOString().split('T')[0]]: expect.anything()
          })
        }),
        expect.any(Function)
      );
    });

    test('should handle cleanup errors gracefully', async () => {
      const { cleanupOldData } = require('@shared/pomodoroStorage');
      
      chrome.runtime.lastError = { message: 'Storage error' };
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        callback({});
      });

      // Should not throw
      await expect(cleanupOldData()).resolves.not.toThrow();
    });
  });

});