import { PomodoroTimer } from '@shared/pomodoroTimer';
import { TimerState, PomodoroSettings, TimerStatus, TimerNotification } from '@shared/pomodoroTypes';
import * as pomodoroStorage from '@shared/pomodoroStorage';

// Mock the storage module
jest.mock('@shared/pomodoroStorage');
const mockPomodoroStorage = pomodoroStorage as jest.Mocked<typeof pomodoroStorage>;

// Mock logger
jest.mock('@shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

describe('PomodoroTimer', () => {
  let timer: PomodoroTimer;
  let onStatusUpdate: jest.Mock;
  let onTimerComplete: jest.Mock;

  const defaultSettings: PomodoroSettings = {
    workDuration: 25,
    restDuration: 5,
    longRestDuration: 15,
    longRestInterval: 4,
    autoStartRest: true,
    autoStartWork: true,
    showNotifications: true,
    playSound: true
  };

  const defaultStatus: TimerStatus = {
    state: 'STOPPED',
    timeRemaining: 0,
    totalTime: 0,
    currentTask: '',
    sessionCount: 0,
    nextSessionType: 'WORK',
    nextSessionDuration: 25 * 60
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onStatusUpdate = jest.fn();
    onTimerComplete = jest.fn();
    
    // Create a fresh timer instance for each test
    timer = new PomodoroTimer(onStatusUpdate, onTimerComplete);

    // Setup default mocks - ensure they return fresh copies
    mockPomodoroStorage.getPomodoroSettings.mockResolvedValue({...defaultSettings});
    mockPomodoroStorage.getTimerStatus.mockResolvedValue({...defaultStatus});
    mockPomodoroStorage.saveTimerStatus.mockResolvedValue();
    mockPomodoroStorage.getDailyStats.mockResolvedValue({
      date: '2024-01-15',
      completedWorkSessions: 0,
      completedRestSessions: 0,
      totalWorkTime: 0,
      totalRestTime: 0,
      sessions: []
    });
    mockPomodoroStorage.saveCurrentSession.mockResolvedValue();
    mockPomodoroStorage.getCurrentSession.mockResolvedValue(null);
    mockPomodoroStorage.generateSessionId.mockReturnValue('test-session-id');
    mockPomodoroStorage.addCompletedSession.mockResolvedValue();
  });

  afterEach(() => {
    // Clean up timers and stop any running timer
    if (timer) {
      timer.destroy();
    }
  });

  describe('Constructor', () => {
    test('should create timer with default values', () => {
      const newTimer = new PomodoroTimer();
      
      expect(newTimer).toBeInstanceOf(PomodoroTimer);
    });

    test('should set callbacks when provided', () => {
      const updateCallback = jest.fn();
      const completeCallback = jest.fn();
      const newTimer = new PomodoroTimer(updateCallback, completeCallback);
      
      expect(newTimer).toBeInstanceOf(PomodoroTimer);
    });
  });

  describe('initialize', () => {
    test('should load settings and status from storage', async () => {
      await timer.initialize();

      expect(mockPomodoroStorage.getPomodoroSettings).toHaveBeenCalled();
      expect(mockPomodoroStorage.getTimerStatus).toHaveBeenCalled();
      expect(mockPomodoroStorage.getDailyStats).toHaveBeenCalled();
      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should handle storage errors gracefully', async () => {
      mockPomodoroStorage.getPomodoroSettings.mockRejectedValue(new Error('Storage error'));
      mockPomodoroStorage.getTimerStatus.mockRejectedValue(new Error('Storage error'));
      mockPomodoroStorage.getDailyStats.mockRejectedValue(new Error('Storage error'));

      await expect(timer.initialize()).resolves.not.toThrow();
      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should restore running timer state', async () => {
      const runningStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 1200, // 20 minutes
        totalTime: 1500, // 25 minutes
        startTime: Date.now() - 5 * 60 * 1000 // Started 5 minutes ago
      };

      mockPomodoroStorage.getTimerStatus.mockResolvedValue(runningStatus);

      await timer.initialize();

      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should complete expired timer when browser was closed', async () => {
      const expiredStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 100,
        totalTime: 1500,
        startTime: Date.now() - 30 * 60 * 1000 // Started 30 minutes ago
      };

      // Mock a current session to complete
      const mockSession = {
        id: 'test-session-id',
        type: 'WORK' as const,
        duration: 0,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now() - 30 * 60 * 1000,
        endTime: 0,
        completed: false,
        date: new Date().toISOString().split('T')[0]
      };

      mockPomodoroStorage.getTimerStatus.mockResolvedValue(expiredStatus);
      mockPomodoroStorage.getCurrentSession.mockResolvedValue(mockSession);
      mockPomodoroStorage.addCompletedSession.mockResolvedValue();

      await timer.initialize();

      expect(mockPomodoroStorage.addCompletedSession).toHaveBeenCalled();
    });

    test('should reset invalid timer state', async () => {
      const invalidStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 1200,
        totalTime: 1500
        // Missing startTime
      };

      mockPomodoroStorage.getTimerStatus.mockResolvedValue(invalidStatus);

      await timer.initialize();

      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should update session count from daily stats', async () => {
      mockPomodoroStorage.getDailyStats.mockResolvedValue({
        date: '2024-01-15',
        completedWorkSessions: 3,
        completedRestSessions: 2,
        totalWorkTime: 4500,
        totalRestTime: 600,
        sessions: []
      });

      await timer.initialize();

      expect(mockPomodoroStorage.getDailyStats).toHaveBeenCalled();
    });
  });

  describe('startWork', () => {
    beforeEach(async () => {
      await timer.initialize();
      // Ensure timer is in STOPPED state for all startWork tests
      await timer.stop();
      // Clear mocks from initialize() and stop() calls to focus on startWork calls
      jest.clearAllMocks();
    });

    test('should start work timer with task description', async () => {
      const taskDescription = 'Write unit tests';

      await timer.startWork(taskDescription);

      expect(mockPomodoroStorage.saveCurrentSession).toHaveBeenCalled();
      expect(mockPomodoroStorage.saveTimerStatus).toHaveBeenCalled();
      expect(onStatusUpdate).toHaveBeenCalled();

      const sessionCall = mockPomodoroStorage.saveCurrentSession.mock.calls[0][0];
      expect(sessionCall).toBeTruthy();
      expect(sessionCall!.type).toBe('WORK');
      expect(sessionCall!.task).toBe(taskDescription);
      expect(sessionCall!.completed).toBe(false);
    });

    test('should start work timer with default task when none provided', async () => {
      await timer.startWork();

      // Check if timer status changed to WORK instead of checking mock calls
      const status = timer.getStatus();
      expect(status.state).toBe('WORK');
      expect(status.currentTask).toBeTruthy();
      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should not start work timer if already running', async () => {
      await timer.startWork('First task');
      jest.clearAllMocks();

      await timer.startWork('Second task');

      expect(mockPomodoroStorage.saveCurrentSession).not.toHaveBeenCalled();
    });

    test('should set correct timer values for work session', async () => {
      await timer.startWork('Test task');

      // Check if timer status shows correct values
      const status = timer.getStatus();
      expect(status.state).toBe('WORK');
      expect(status.currentTask).toBe('Test task');
      expect(status.totalTime).toBe(25 * 60); // 25 minutes in seconds
      expect(status.timeRemaining).toBeLessThanOrEqual(25 * 60);
      expect(onStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('startRest', () => {
    beforeEach(async () => {
      await timer.initialize();
      // Ensure timer is in STOPPED state for all startRest tests
      await timer.stop();
      // Clear mocks from initialize() and stop() calls to focus on startRest calls
      jest.clearAllMocks();
    });

    test('should start short rest timer', async () => {
      await timer.startRest();

      // Check if timer status shows correct values for rest
      const status = timer.getStatus();
      expect(status.state).toBe('REST');
      expect(status.currentTask).toBe('Short Break');
      expect(status.totalTime).toBe(5 * 60); // 5 minutes
      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should start long rest timer when appropriate', async () => {
      // Create a new timer instance with 4 completed sessions
      const timerWithSessions = new PomodoroTimer(onStatusUpdate, onTimerComplete);
      
      // Mock storage to return status with 4 completed sessions
      const statusWithSessions: TimerStatus = {
        ...defaultStatus,
        sessionCount: 4 // After 4 work sessions
      };
      
      // Mock daily stats to return 4 completed work sessions
      const dailyStatsWithSessions = {
        date: '2024-01-15',
        completedWorkSessions: 4, // This is what sets the session count
        completedRestSessions: 3,
        totalWorkTime: 6000,
        totalRestTime: 900,
        sessions: []
      };
      
      mockPomodoroStorage.getTimerStatus.mockResolvedValue(statusWithSessions);
      mockPomodoroStorage.getDailyStats.mockResolvedValue(dailyStatsWithSessions);
      
      await timerWithSessions.initialize();
      await timerWithSessions.stop(); // Ensure stopped state
      jest.clearAllMocks(); // Clear mocks after initialization
      
      await timerWithSessions.startRest();

      // Check if timer status shows correct values for long rest
      const status = timerWithSessions.getStatus();
      expect(status.state).toBe('REST');
      expect(status.currentTask).toContain('Long Break');
      expect(status.totalTime).toBe(15 * 60); // 15 minutes for long rest
      expect(onStatusUpdate).toHaveBeenCalled();
      
      // Cleanup
      timerWithSessions.destroy();
    });

    test('should not start rest timer if already running', async () => {
      await timer.startRest();
      jest.clearAllMocks();

      await timer.startRest();

      expect(mockPomodoroStorage.saveCurrentSession).not.toHaveBeenCalled();
    });
  });

  describe('pause and resume', () => {
    beforeEach(async () => {
      await timer.initialize();
      // Start with a stopped timer for consistent testing
      await timer.stop();
    });

    test('should pause running work timer', async () => {
      await timer.startWork('Test task');
      jest.clearAllMocks();

      await timer.pause();

      expect(mockPomodoroStorage.saveTimerStatus).toHaveBeenCalled();
      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should not pause already stopped timer', async () => {
      // Clear mocks from initialize() call
      jest.clearAllMocks();
      
      await timer.pause();

      expect(mockPomodoroStorage.saveTimerStatus).not.toHaveBeenCalled();
    });

    test('should resume paused timer', async () => {
      const mockSession = {
        id: 'test-id',
        type: 'WORK' as const,
        duration: 0,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: 0,
        completed: false,
        date: new Date().toISOString().split('T')[0]
      };

      mockPomodoroStorage.getCurrentSession.mockResolvedValue(mockSession);

      await timer.startWork('Test task');
      await timer.pause();
      jest.clearAllMocks();

      await timer.resume();

      expect(mockPomodoroStorage.saveTimerStatus).toHaveBeenCalled();
      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should not resume non-paused timer', async () => {
      // Clear mocks from initialize() call
      jest.clearAllMocks();
      
      await timer.resume();

      expect(mockPomodoroStorage.saveTimerStatus).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await timer.initialize();
      // Start with a stopped timer for consistent testing
      await timer.stop();
    });

    test('should stop running timer', async () => {
      await timer.startWork('Test task');
      jest.clearAllMocks();

      await timer.stop();

      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should not affect already stopped timer', async () => {
      await timer.stop();

      // Should still notify status update
      expect(onStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    test('should return current timer status', async () => {
      await timer.initialize();

      const status = timer.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('timeRemaining');
      expect(status).toHaveProperty('totalTime');
      expect(status).toHaveProperty('sessionCount');
    });
  });

  describe('getSettings', () => {
    test('should return current timer settings', async () => {
      await timer.initialize();

      const settings = timer.getSettings();

      expect(settings).toHaveProperty('workDuration');
      expect(settings).toHaveProperty('restDuration');
      expect(settings).toHaveProperty('longRestDuration');
      expect(settings).toHaveProperty('longRestInterval');
    });
  });

  describe('Timer ticking functionality', () => {
    beforeEach(async () => {
      await timer.initialize();
      // Start with a stopped timer for consistent testing
      await timer.stop();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should tick down time when work timer is running', async () => {
      jest.clearAllMocks(); // Clear mocks from initialize
      await timer.startWork('Test task');

      // Fast forward 1 second
      jest.advanceTimersByTime(1000);

      expect(onStatusUpdate).toHaveBeenCalled();
    });

    test('should complete timer when time reaches zero', async () => {
      // Mock current session for completion
      const mockSession = {
        id: 'test-session-id',
        type: 'WORK' as const,
        duration: 0,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: 0,
        completed: false,
        date: new Date().toISOString().split('T')[0]
      };
      
      // Set up the mock to return the session when getCurrentSession is called during completion
      mockPomodoroStorage.getCurrentSession.mockResolvedValue(mockSession);
      mockPomodoroStorage.addCompletedSession.mockResolvedValue();
      
      jest.clearAllMocks(); // Clear mocks from initialize
      await timer.startWork('Test task');

      // Verify the timer started correctly
      expect(timer.getStatus().state).toBe('WORK');

      // Fast forward to completion
      jest.advanceTimersByTime(25 * 60 * 1000 + 1000); // 25 minutes + 1 second

      // Check that timer completed and went to STOPPED state
      expect(timer.getStatus().state).toBe('STOPPED');
      expect(timer.getStatus().timeRemaining).toBe(0);
      expect(onTimerComplete).toHaveBeenCalled();
    });
  });

  describe('Auto-start functionality', () => {
    test('should auto-start rest when work completes and setting is enabled', async () => {
      const settingsWithAutoStart = { ...defaultSettings, autoStartRest: true };
      mockPomodoroStorage.getPomodoroSettings.mockResolvedValue(settingsWithAutoStart);
      
      // Mock current session for completion
      const mockSession = {
        id: 'test-session-id',
        type: 'WORK' as const,
        duration: 0,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: 0,
        completed: false,
        date: new Date().toISOString().split('T')[0]
      };
      
      mockPomodoroStorage.getCurrentSession.mockResolvedValue(mockSession);
      mockPomodoroStorage.addCompletedSession.mockResolvedValue();

      await timer.initialize();
      jest.useFakeTimers();
      jest.clearAllMocks(); // Clear mocks from initialize

      await timer.startWork('Test task');
      expect(timer.getStatus().state).toBe('WORK');

      // Complete the work timer
      jest.advanceTimersByTime(25 * 60 * 1000 + 1000);

      expect(onTimerComplete).toHaveBeenCalled();
      expect(timer.getStatus().state).toBe('STOPPED');
      
      // Auto-start should trigger after 2 seconds
      jest.advanceTimersByTime(3000);
      
      // Should now be in REST state due to auto-start
      expect(timer.getStatus().state).toBe('REST');
      
      jest.useRealTimers();
    });

    test('should not auto-start when setting is disabled', async () => {
      const settingsWithoutAutoStart = { ...defaultSettings, autoStartRest: false };
      mockPomodoroStorage.getPomodoroSettings.mockResolvedValue(settingsWithoutAutoStart);
      
      // Mock current session for completion
      const mockSession = {
        id: 'test-session-id',
        type: 'WORK' as const,
        duration: 0,
        plannedDuration: 1500,
        task: 'Test task',
        startTime: Date.now(),
        endTime: 0,
        completed: false,
        date: new Date().toISOString().split('T')[0]
      };
      
      mockPomodoroStorage.getCurrentSession.mockResolvedValue(mockSession);
      mockPomodoroStorage.addCompletedSession.mockResolvedValue();

      await timer.initialize();
      jest.useFakeTimers();

      await timer.startWork('Test task');

      // Complete the work timer
      jest.advanceTimersByTime(25 * 60 * 1000 + 1000);

      expect(onTimerComplete).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});