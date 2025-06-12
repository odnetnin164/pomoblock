import { BackgroundPomodoroManager } from '@background/BackgroundPomodoroManager';
import { PomodoroTimer } from '@shared/pomodoroTimer';
import { TimerStatus, TimerNotification } from '@shared/pomodoroTypes';
import * as pomodoroStorage from '@shared/pomodoroStorage';

// Mock dependencies
jest.mock('@shared/pomodoroTimer');
jest.mock('@shared/pomodoroStorage');
jest.mock('@shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn().mockResolvedValue({}),
    getURL: jest.fn(path => `chrome-extension://test/${path}`)
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    openPopup: jest.fn().mockResolvedValue({})
  },
  alarms: {
    onAlarm: {
      addListener: jest.fn()
    },
    create: jest.fn()
  },
  notifications: {
    create: jest.fn()
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    sendMessage: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({})
  }
};

(global as any).chrome = mockChrome;

const mockPomodoroStorage = pomodoroStorage as jest.Mocked<typeof pomodoroStorage>;
const MockPomodoroTimer = PomodoroTimer as jest.MockedClass<typeof PomodoroTimer>;

describe('BackgroundPomodoroManager', () => {
  let manager: BackgroundPomodoroManager;
  let mockTimer: jest.Mocked<PomodoroTimer>;
  let onStatusUpdateCallback: (status: TimerStatus) => void;
  let onTimerCompleteCallback: (notification: TimerNotification) => void;

  const defaultStatus: TimerStatus = {
    state: 'STOPPED',
    timeRemaining: 0,
    totalTime: 0,
    currentTask: '',
    sessionCount: 0,
    nextSessionType: 'WORK',
    nextSessionDuration: 25 * 60
  };

  const defaultSettings = {
    workDuration: 25,
    restDuration: 5,
    longRestDuration: 15,
    longRestInterval: 4,
    autoStartRest: true,
    autoStartWork: true,
    showNotifications: true,
    playSound: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup timer mock
    mockTimer = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue(defaultStatus),
      getSettings: jest.fn().mockReturnValue(defaultSettings),
      startWork: jest.fn().mockResolvedValue(undefined),
      startRest: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      updateCurrentTask: jest.fn().mockResolvedValue(undefined),
      updateSettings: jest.fn().mockResolvedValue(undefined),
      advanceToNextSession: jest.fn().mockResolvedValue(undefined),
      shouldBlockSites: jest.fn().mockReturnValue(false),
      destroy: jest.fn()
    } as any;

    // Mock PomodoroTimer constructor to capture callbacks and return our mock
    MockPomodoroTimer.mockImplementation((onStatusUpdate, onTimerComplete) => {
      onStatusUpdateCallback = onStatusUpdate!;
      onTimerCompleteCallback = onTimerComplete!;
      return mockTimer;
    });

    // Setup storage mocks
    mockPomodoroStorage.getPomodoroSettings.mockResolvedValue(defaultSettings);
    mockPomodoroStorage.savePomodoroSettings.mockResolvedValue();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('Constructor and Initialization', () => {
    test('should create manager and setup message listeners', () => {
      manager = new BackgroundPomodoroManager();
      
      expect(MockPomodoroTimer).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function)
      );
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should initialize timer and setup listeners', async () => {
      manager = new BackgroundPomodoroManager();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTimer.initialize).toHaveBeenCalled();
      expect(mockChrome.alarms.onAlarm.addListener).toHaveBeenCalled();
      expect(mockChrome.action.setBadgeText).toHaveBeenCalled();
    });

    test('should handle initialization errors gracefully', async () => {
      mockTimer.initialize.mockRejectedValue(new Error('Init failed'));
      
      manager = new BackgroundPomodoroManager();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockTimer.initialize).toHaveBeenCalled();
      expect(mockChrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      manager = new BackgroundPomodoroManager();
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should handle GET_TIMER_STATUS message', async () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      const message = { type: 'GET_TIMER_STATUS' };
      
      messageListener(message, {}, sendResponse);
      
      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(sendResponse).toHaveBeenCalledWith({ status: defaultStatus });
    });

    test('should handle START_WORK message', async () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      const message = { type: 'START_WORK', task: 'Test task' };
      
      messageListener(message, {}, sendResponse);
      
      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTimer.startWork).toHaveBeenCalledWith('Test task');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle UPDATE_POMODORO_SETTINGS message', async () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      const newSettings = { ...defaultSettings, workDuration: 30 };
      const message = { type: 'UPDATE_POMODORO_SETTINGS', settings: newSettings };
      
      messageListener(message, {}, sendResponse);
      
      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTimer.updateSettings).toHaveBeenCalledWith(newSettings);
      expect(mockPomodoroStorage.savePomodoroSettings).toHaveBeenCalledWith(newSettings);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle unknown message type', async () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      const message = { type: 'UNKNOWN_TYPE' };
      
      messageListener(message, {}, sendResponse);
      
      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(sendResponse).toHaveBeenCalledWith({ 
        error: 'Unknown message type: UNKNOWN_TYPE' 
      });
    });
  });

  describe('Status Updates and Badge', () => {
    beforeEach(async () => {
      manager = new BackgroundPomodoroManager();
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should update badge when status changes', () => {
      const workStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500
      };
      
      mockTimer.getStatus.mockReturnValue(workStatus);
      
      // Trigger status update
      onStatusUpdateCallback(workStatus);
      
      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '25:00' });
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#f44336' });
    });

    test('should format time correctly for badge', () => {
      const restStatus: TimerStatus = {
        ...defaultStatus,
        state: 'REST',
        timeRemaining: 65,
        totalTime: 300
      };
      
      mockTimer.getStatus.mockReturnValue(restStatus);
      
      // Trigger status update
      onStatusUpdateCallback(restStatus);
      
      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1:05' });
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#4CAF50' });
    });

    test('should clear badge text when stopped', () => {
      mockTimer.getStatus.mockReturnValue(defaultStatus);
      
      // Trigger status update
      onStatusUpdateCallback(defaultStatus);
      
      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#4CAF50' });
    });
  });

  describe('Timer Completion', () => {
    beforeEach(async () => {
      manager = new BackgroundPomodoroManager();
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should show notification when timer completes', async () => {
      const notification: TimerNotification = {
        title: 'Work Session Complete!',
        message: 'Time for a break!',
        type: 'work_complete'
      };
      
      // Trigger timer completion
      await onTimerCompleteCallback(notification);
      
      expect(mockChrome.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'chrome-extension://test/icons/icon48.png',
        title: 'Work Session Complete!',
        message: 'Time for a break!',
        priority: 2
      });
    });

    test('should not show notification when disabled', async () => {
      const disabledSettings = { ...defaultSettings, showNotifications: false };
      mockPomodoroStorage.getPomodoroSettings.mockResolvedValue(disabledSettings);
      
      const notification: TimerNotification = {
        title: 'Work Session Complete!',
        message: 'Time for a break!',
        type: 'work_complete'
      };
      
      // Trigger timer completion
      await onTimerCompleteCallback(notification);
      
      expect(mockChrome.notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('Legacy Methods', () => {
    beforeEach(async () => {
      manager = new BackgroundPomodoroManager();
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should return blocking status', () => {
      mockTimer.shouldBlockSites.mockReturnValue(true);
      
      expect(manager.isTimerBlocking()).toBe(true);
      
      mockTimer.shouldBlockSites.mockReturnValue(false);
      
      expect(manager.isTimerBlocking()).toBe(false);
    });

    test('should return current status', () => {
      const workStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 1200
      };
      
      mockTimer.getStatus.mockReturnValue(workStatus);
      
      expect(manager.getCurrentStatus()).toEqual(workStatus);
    });

    test('should return current timer state', () => {
      const workStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK'
      };
      
      mockTimer.getStatus.mockReturnValue(workStatus);
      
      expect(manager.getCurrentTimerState()).toBe('WORK');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on destroy', async () => {
      manager = new BackgroundPomodoroManager();
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      manager.destroy();
      
      expect(mockTimer.destroy).toHaveBeenCalled();
    });
  });
});