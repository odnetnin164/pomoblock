import { BackgroundPomodoroManager } from '../src/background/BackgroundPomodoroManager';
import { cleanupOldData } from '@shared/pomodoroStorage';
import { logger } from '@shared/logger';

// Mock dependencies
jest.mock('../src/background/BackgroundPomodoroManager');
jest.mock('@shared/pomodoroStorage');
jest.mock('@shared/logger');

const mockCleanupOldData = cleanupOldData as jest.MockedFunction<typeof cleanupOldData>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onStartup: { addListener: jest.fn() },
    onInstalled: { addListener: jest.fn() },
    onSuspend: { addListener: jest.fn() },
    onSuspendCanceled: { addListener: jest.fn() },
    sendMessage: jest.fn(),
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`)
  },
  notifications: {
    getPermissionLevel: jest.fn(),
    onClicked: { addListener: jest.fn() }
  },
  contextMenus: {
    removeAll: jest.fn(),
    create: jest.fn(),
    onClicked: { addListener: jest.fn() }
  },
  action: {
    onClicked: { addListener: jest.fn() },
    openPopup: jest.fn()
  },
  tabs: {
    onUpdated: { addListener: jest.fn() },
    query: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  },
  alarms: {
    onAlarm: { addListener: jest.fn() }
  }
};

(global as any).chrome = mockChrome;

describe('Background Index - Behavior Tests', () => {
  let mockPomodoroManager: jest.Mocked<BackgroundPomodoroManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset global state
    delete (global as any).pomodoroManager;
    
    // Mock BackgroundPomodoroManager
    mockPomodoroManager = {
      isTimerBlocking: jest.fn().mockReturnValue(false),
      getCurrentStatus: jest.fn().mockReturnValue({ state: 'STOPPED' }),
      destroy: jest.fn()
    } as any;
    
    (BackgroundPomodoroManager as jest.MockedClass<typeof BackgroundPomodoroManager>)
      .mockImplementation(() => mockPomodoroManager);

    // Setup default Chrome API responses
    mockCleanupOldData.mockResolvedValue();
    mockChrome.notifications.getPermissionLevel.mockImplementation((callback) => {
      callback('granted');
    });
    mockChrome.contextMenus.removeAll.mockImplementation((callback) => {
      callback();
    });
  });

  describe('Extension Lifecycle', () => {
    test('should initialize pomodoro manager on startup', async () => {
      // Import the background script
      await import('../src/background/index');
      
      // Should create pomodoro manager
      expect(BackgroundPomodoroManager).toHaveBeenCalled();
      expect((global as any).pomodoroManager).toBeDefined();
      expect(mockLogger.log).toHaveBeenCalledWith('Initializing PomoBlock background script');
    });

    test('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (BackgroundPomodoroManager as jest.MockedClass<typeof BackgroundPomodoroManager>)
        .mockImplementationOnce(() => {
          throw new Error('Init failed');
        });

      // Should not throw on import
      await expect(import('../src/background/index')).resolves.toBeDefined();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error initializing BackgroundPomodoroManager:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('should register all required Chrome event listeners', async () => {
      await import('../src/background/index');

      // Should register all lifecycle listeners
      expect(mockChrome.runtime.onStartup.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onSuspend.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onSuspendCanceled.addListener).toHaveBeenCalled();
      
      // Should register UI interaction listeners
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(mockChrome.notifications.onClicked.addListener).toHaveBeenCalled();
      expect(mockChrome.contextMenus.onClicked.addListener).toHaveBeenCalled();
      
      // Should register tab and alarm listeners
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockChrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    });
  });

  describe('Installation and Updates', () => {
    test('should perform cleanup and setup on installation', async () => {
      await import('../src/background/index');
      
      // Trigger the installed event
      const installedHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      await installedHandler();

      // Should perform data cleanup
      expect(mockCleanupOldData).toHaveBeenCalled();
      
      // Should setup context menus
      expect(mockChrome.contextMenus.removeAll).toHaveBeenCalled();
      expect(mockChrome.contextMenus.create).toHaveBeenCalled();
      
      expect(mockLogger.log).toHaveBeenCalledWith('PomoBlock extension installed/updated');
    });

    test('should handle cleanup errors during installation', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCleanupOldData.mockRejectedValue(new Error('Cleanup failed'));

      await import('../src/background/index');
      
      const installedHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      await installedHandler();

      expect(consoleSpy).toHaveBeenCalledWith('Error cleaning up old data:', expect.any(Error));
      // Should continue with context menu setup despite cleanup errors
      expect(mockChrome.contextMenus.removeAll).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle notification permission issues', async () => {
      mockChrome.notifications.getPermissionLevel.mockImplementation(() => {
        throw new Error('Permission error');
      });

      await import('../src/background/index');
      
      const installedHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      await installedHandler();

      expect(mockLogger.log).toHaveBeenCalledWith('Notification permission not available');
    });
  });

  describe('Context Menu Integration', () => {
    test('should handle start pomodoro action', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({});
      
      await import('../src/background/index');
      
      const contextMenuHandler = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await contextMenuHandler({ menuItemId: 'startPomodoro' }, { id: 123 });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ 
        type: 'START_WORK', 
        task: 'Quick Start' 
      });
    });

    test('should handle stop pomodoro action', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({});
      
      await import('../src/background/index');
      
      const contextMenuHandler = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await contextMenuHandler({ menuItemId: 'stopPomodoro' }, { id: 123 });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'STOP_TIMER' });
    });

    test('should handle history page action', async () => {
      await import('../src/background/index');
      
      const contextMenuHandler = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await contextMenuHandler({ menuItemId: 'pomodoroHistory' }, { id: 123 });

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({ 
        url: 'chrome-extension://test/history.html' 
      });
    });

    test('should handle context menu errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPomodoroManager.getCurrentStatus.mockImplementation(() => {
        throw new Error('Status error');
      });

      await import('../src/background/index');
      
      const contextMenuHandler = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await contextMenuHandler({ menuItemId: 'startPomodoro' }, { id: 123 });

      expect(consoleSpy).toHaveBeenCalledWith('Error handling context menu click:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Tab Management', () => {
    test('should monitor tab updates when timer is blocking', async () => {
      mockPomodoroManager.isTimerBlocking.mockReturnValue(true);
      
      await import('../src/background/index');
      
      const tabUpdateHandler = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0];
      await tabUpdateHandler(123, { status: 'complete' }, { url: 'https://example.com' });

      expect(mockPomodoroManager.isTimerBlocking).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Pomodoro timer is blocking, tab updated:', 'https://example.com');
    });

    test('should ignore incomplete tab updates', async () => {
      await import('../src/background/index');
      
      const tabUpdateHandler = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0];
      await tabUpdateHandler(123, { status: 'loading' }, { url: 'https://example.com' });

      expect(mockPomodoroManager.isTimerBlocking).not.toHaveBeenCalled();
    });
  });

  describe('Notification Handling', () => {
    test('should open popup when notification is clicked', async () => {
      mockChrome.action.openPopup.mockResolvedValue(undefined);
      
      await import('../src/background/index');
      
      const notificationHandler = mockChrome.notifications.onClicked.addListener.mock.calls[0][0];
      await notificationHandler('notification-id');

      expect(mockChrome.action.openPopup).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Notification clicked:', 'notification-id');
    });

    test('should fallback to tab focus if popup fails', async () => {
      mockChrome.action.openPopup.mockRejectedValue(new Error('Popup failed'));
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 456 }]);
      });

      await import('../src/background/index');
      
      const notificationHandler = mockChrome.notifications.onClicked.addListener.mock.calls[0][0];
      await notificationHandler('notification-id');

      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(456, { active: true });
    });
  });

  describe('Extension Suspension', () => {
    test('should cleanup on suspension', async () => {
      await import('../src/background/index');
      
      const suspendHandler = mockChrome.runtime.onSuspend.addListener.mock.calls[0][0];
      suspendHandler();

      expect(mockPomodoroManager.destroy).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('PomoBlock extension suspending');
    });

    test('should log when suspension is cancelled', async () => {
      await import('../src/background/index');
      
      const suspendCancelledHandler = mockChrome.runtime.onSuspendCanceled.addListener.mock.calls[0][0];
      suspendCancelledHandler();

      expect(mockLogger.log).toHaveBeenCalledWith('PomoBlock extension suspend cancelled');
    });
  });

  describe('Alarm Processing', () => {
    test('should handle pomodoro alarms', async () => {
      await import('../src/background/index');
      
      const alarmHandler = mockChrome.alarms.onAlarm.addListener.mock.calls[0][0];
      alarmHandler({ name: 'pomodoro-work-timer' });

      expect(mockLogger.log).toHaveBeenCalledWith('Alarm triggered:', 'pomodoro-work-timer');
      expect(mockLogger.log).toHaveBeenCalledWith('Pomodoro alarm handled by BackgroundPomodoroManager');
    });

    test('should handle non-pomodoro alarms', async () => {
      await import('../src/background/index');
      
      const alarmHandler = mockChrome.alarms.onAlarm.addListener.mock.calls[0][0];
      alarmHandler({ name: 'other-alarm' });

      expect(mockLogger.log).toHaveBeenCalledWith('Alarm triggered:', 'other-alarm');
      expect(mockLogger.log).not.toHaveBeenCalledWith('Pomodoro alarm handled by BackgroundPomodoroManager');
    });
  });

  describe('Startup Recovery', () => {
    test('should reinitialize manager on startup if not present', async () => {
      await import('../src/background/index');
      
      // Clear the manager to simulate restart
      delete (global as any).pomodoroManager;
      
      const startupHandler = mockChrome.runtime.onStartup.addListener.mock.calls[0][0];
      await startupHandler();

      expect(mockLogger.log).toHaveBeenCalledWith('PomoBlock extension starting up');
      expect(BackgroundPomodoroManager).toHaveBeenCalledTimes(2); // Once on import, once on startup
    });

    test('should not reinitialize if manager exists', async () => {
      await import('../src/background/index');
      
      // Manager should exist from initialization
      const startupHandler = mockChrome.runtime.onStartup.addListener.mock.calls[0][0];
      await startupHandler();

      expect(BackgroundPomodoroManager).toHaveBeenCalledTimes(1); // Only once on import
    });
  });

  describe('Extension Icon Handling', () => {
    test('should handle extension icon clicks', async () => {
      await import('../src/background/index');
      
      const actionHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
      actionHandler({ id: 123, url: 'https://example.com' });

      expect(mockLogger.log).toHaveBeenCalledWith('Extension icon clicked', { 
        id: 123, 
        url: 'https://example.com' 
      });
    });
  });

  describe('Global Manager Access', () => {
    test('should make manager available globally for testing', async () => {
      await import('../src/background/index');
      
      expect((global as any).pomodoroManager).toBeDefined();
      expect((global as any).pomodoroManager).toBe(mockPomodoroManager);
    });

    test('should handle missing manager gracefully in context menu', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await import('../src/background/index');
      
      // Clear the manager to simulate not initialized
      delete (global as any).pomodoroManager;
      
      const contextMenuHandler = mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
      await contextMenuHandler({ menuItemId: 'startPomodoro' }, { id: 123 });

      expect(consoleSpy).toHaveBeenCalledWith('PomodoroManager not initialized');
      consoleSpy.mockRestore();
    });
  });
});