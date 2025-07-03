import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_WORK_HOURS,
  DEBUG_CONFIG,
  POMODORO_STORAGE_KEYS,
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_TIMER_STATUS
} from '@shared/constants';

describe('Constants', () => {
  describe('STORAGE_KEYS', () => {
    test('should contain all required storage keys', () => {
      expect(STORAGE_KEYS.BLOCKED_WEBSITES).toBeDefined();
      expect(STORAGE_KEYS.WHITELISTED_PATHS).toBeDefined();
      expect(STORAGE_KEYS.EXTENSION_ENABLED).toBeDefined();
      expect(STORAGE_KEYS.BLOCK_MODE).toBeDefined();
      expect(STORAGE_KEYS.REDIRECT_URL).toBeDefined();
      expect(STORAGE_KEYS.REDIRECT_DELAY).toBeDefined();
      expect(STORAGE_KEYS.DEBUG_ENABLED).toBeDefined();
      expect(STORAGE_KEYS.WORK_HOURS_ENABLED).toBeDefined();
      expect(STORAGE_KEYS.WORK_HOURS_START_TIME).toBeDefined();
      expect(STORAGE_KEYS.WORK_HOURS_END_TIME).toBeDefined();
      expect(STORAGE_KEYS.WORK_HOURS_DAYS).toBeDefined();
    });

    test('should have string values for all keys', () => {
      Object.values(STORAGE_KEYS).forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_SETTINGS.extensionEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.blockMode).toBe('block');
      expect(DEFAULT_SETTINGS.redirectUrl).toBe('https://www.google.com');
      expect(DEFAULT_SETTINGS.redirectDelay).toBe(3);
      expect(DEFAULT_SETTINGS.debugEnabled).toBe(false);
    });

    test('should include work hours settings', () => {
      expect(DEFAULT_SETTINGS.workHours).toBeDefined();
      expect(DEFAULT_SETTINGS.workHours.enabled).toBe(false);
      expect(DEFAULT_SETTINGS.workHours.startTime).toBe('09:00');
      expect(DEFAULT_SETTINGS.workHours.endTime).toBe('17:00');
      expect(Array.isArray(DEFAULT_SETTINGS.workHours.days)).toBe(true);
    });

    test('should include pomodoro settings', () => {
      expect(DEFAULT_SETTINGS.pomodoro).toBeDefined();
      expect(DEFAULT_SETTINGS.pomodoro.workDuration).toBe(25);
      expect(DEFAULT_SETTINGS.pomodoro.restDuration).toBe(5);
      expect(DEFAULT_SETTINGS.pomodoro.longRestDuration).toBe(15);
      expect(DEFAULT_SETTINGS.pomodoro.longRestInterval).toBe(4);
    });
  });

  describe('DEFAULT_WORK_HOURS', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_WORK_HOURS.enabled).toBe(false);
      expect(DEFAULT_WORK_HOURS.startTime).toBe('09:00');
      expect(DEFAULT_WORK_HOURS.endTime).toBe('17:00');
      expect(DEFAULT_WORK_HOURS.days).toEqual([1, 2, 3, 4, 5]); // Monday to Friday
    });

    test('should have valid time format', () => {
      const timeRegex = /^[0-2][0-9]:[0-5][0-9]$/;
      expect(timeRegex.test(DEFAULT_WORK_HOURS.startTime)).toBe(true);
      expect(timeRegex.test(DEFAULT_WORK_HOURS.endTime)).toBe(true);
    });

    test('should have valid day numbers', () => {
      DEFAULT_WORK_HOURS.days.forEach(day => {
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThanOrEqual(6);
      });
    });
  });

  describe('DEBUG_CONFIG', () => {
    test('should have expected debug configuration', () => {
      expect(DEBUG_CONFIG.MAX_LOG_ENTRIES).toBe(10);
      expect(DEBUG_CONFIG.DEBUG_DIV_ID).toBe('pomoblock-debug');
    });

    test('should have reasonable max log entries', () => {
      expect(DEBUG_CONFIG.MAX_LOG_ENTRIES).toBeGreaterThan(0);
      expect(DEBUG_CONFIG.MAX_LOG_ENTRIES).toBeLessThan(1000);
    });
  });

  describe('POMODORO_STORAGE_KEYS', () => {
    test('should contain all pomodoro storage keys', () => {
      expect(POMODORO_STORAGE_KEYS.SETTINGS).toBeDefined();
      expect(POMODORO_STORAGE_KEYS.TIMER_STATUS).toBeDefined();
      expect(POMODORO_STORAGE_KEYS.CURRENT_SESSION).toBeDefined();
      expect(POMODORO_STORAGE_KEYS.DAILY_STATS).toBeDefined();
      expect(POMODORO_STORAGE_KEYS.SESSIONS_HISTORY).toBeDefined();
    });

    test('should have string key values', () => {
      Object.values(POMODORO_STORAGE_KEYS).forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });

  describe('DEFAULT_POMODORO_SETTINGS', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_POMODORO_SETTINGS.workDuration).toBe(25);
      expect(DEFAULT_POMODORO_SETTINGS.restDuration).toBe(5);
      expect(DEFAULT_POMODORO_SETTINGS.longRestDuration).toBe(15);
      expect(DEFAULT_POMODORO_SETTINGS.longRestInterval).toBe(4);
      expect(DEFAULT_POMODORO_SETTINGS.autoStartRest).toBe(true);
      expect(DEFAULT_POMODORO_SETTINGS.autoStartWork).toBe(true);
      expect(DEFAULT_POMODORO_SETTINGS.showNotifications).toBe(true);
      expect(DEFAULT_POMODORO_SETTINGS.playSound).toBe(true);
    });

    test('should have positive duration values', () => {
      expect(DEFAULT_POMODORO_SETTINGS.workDuration).toBeGreaterThan(0);
      expect(DEFAULT_POMODORO_SETTINGS.restDuration).toBeGreaterThan(0);
      expect(DEFAULT_POMODORO_SETTINGS.longRestDuration).toBeGreaterThan(0);
      expect(DEFAULT_POMODORO_SETTINGS.longRestInterval).toBeGreaterThan(0);
    });

    test('should have boolean flags', () => {
      expect(typeof DEFAULT_POMODORO_SETTINGS.autoStartRest).toBe('boolean');
      expect(typeof DEFAULT_POMODORO_SETTINGS.autoStartWork).toBe('boolean');
      expect(typeof DEFAULT_POMODORO_SETTINGS.showNotifications).toBe('boolean');
      expect(typeof DEFAULT_POMODORO_SETTINGS.playSound).toBe('boolean');
    });
  });

  describe('DEFAULT_TIMER_STATUS', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_TIMER_STATUS.state).toBe('STOPPED');
      expect(DEFAULT_TIMER_STATUS.timeRemaining).toBe(0);
      expect(DEFAULT_TIMER_STATUS.totalTime).toBe(0);
      expect(DEFAULT_TIMER_STATUS.currentTask).toBe('');
      expect(DEFAULT_TIMER_STATUS.sessionCount).toBe(0);
      expect(DEFAULT_TIMER_STATUS.nextSessionType).toBe('WORK');
      expect(DEFAULT_TIMER_STATUS.nextSessionDuration).toBe(25 * 60);
    });

    test('should have valid state', () => {
      const validStates = ['STOPPED', 'WORK', 'REST', 'PAUSED'];
      expect(validStates).toContain(DEFAULT_TIMER_STATUS.state);
    });

    test('should have valid next session type', () => {
      const validTypes = ['WORK', 'REST'];
      expect(validTypes).toContain(DEFAULT_TIMER_STATUS.nextSessionType);
    });

    test('should have reasonable default duration', () => {
      expect(DEFAULT_TIMER_STATUS.nextSessionDuration).toBe(1500); // 25 minutes in seconds
    });
  });
});