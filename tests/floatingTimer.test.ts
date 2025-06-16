import { FloatingTimer } from '@contentScript/ui/floatingTimer';
import { TimerStatus, TimerState } from '@shared/pomodoroTypes';
import { DEFAULT_FLOATING_TIMER_SETTINGS, POMODORO_STORAGE_KEYS } from '@shared/constants';
import { PomodoroTimer } from '@shared/pomodoroTimer';

// Mock dependencies
jest.mock('@shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

jest.mock('@shared/pomodoroTimer');
jest.mock('@shared/pomodoroStorage', () => ({
  formatDuration: jest.fn((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  })
}));

const MockPomodoroTimer = PomodoroTimer as jest.MockedClass<typeof PomodoroTimer>;

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    getURL: jest.fn(),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: jest.fn(),
  configurable: true
});

describe('FloatingTimer', () => {
  let floatingTimer: FloatingTimer;
  let mockTimerInstance: jest.Mocked<PomodoroTimer>;
  let mockStorageGetResponse: any;
  let mockMessageListener: any;
  let mockStorageChangeListener: any;

  const defaultTimerStatus: TimerStatus = {
    state: 'STOPPED',
    timeRemaining: 0,
    totalTime: 0,
    currentTask: '',
    sessionCount: 0,
    nextSessionType: 'WORK',
    nextSessionDuration: 25 * 60,
    lastCompletedSessionType: undefined
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup DOM
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '<head></head><body></body>';
    
    // Mock chrome.storage.local.get
    mockStorageGetResponse = {};
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      if (callback) {
        callback(mockStorageGetResponse);
      }
      return Promise.resolve(mockStorageGetResponse);
    });
    
    // Mock chrome.storage.local.set
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    
    // Mock chrome.runtime.getURL
    mockChrome.runtime.getURL.mockReturnValue('shared/floating-timer.css');
    
    // Mock chrome.runtime.sendMessage
    mockChrome.runtime.sendMessage.mockResolvedValue({ status: defaultTimerStatus });
    
    // Capture message listeners
    mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      mockMessageListener = listener;
    });
    
    // Capture storage change listeners
    mockChrome.storage.onChanged.addListener.mockImplementation((listener) => {
      mockStorageChangeListener = listener;
    });
    
    // Mock PomodoroTimer
    mockTimerInstance = {
      setStatusForUI: jest.fn(),
      getSessionDisplayInfo: jest.fn().mockReturnValue({
        sessionIcon: '🍅',
        sessionText: 'Session #1 - Work',
        sessionNumber: 1
      }),
      getDisplayTime: jest.fn().mockReturnValue('25:00'),
      getProgressPercentage: jest.fn().mockReturnValue(50),
      destroy: jest.fn()
    } as any;
    
    MockPomodoroTimer.mockImplementation(() => mockTimerInstance);
    
    // Mock window properties
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
    
    // Mock document.hidden
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    if (floatingTimer) {
      floatingTimer.destroy();
    }
    
    // Clean up DOM
    const widget = document.getElementById('pomoblock-floating-timer');
    if (widget) {
      widget.remove();
    }
    
    const styles = document.getElementById('pomoblock-floating-timer-styles');
    if (styles) {
      styles.remove();
    }
    
    const shakeStyles = document.getElementById('pomoblock-shake-animation');
    if (shakeStyles) {
      shakeStyles.remove();
    }
  });

  describe('Constructor and Initialization', () => {
    test('should create FloatingTimer instance', async () => {
      floatingTimer = new FloatingTimer();
      
      expect(floatingTimer).toBeInstanceOf(FloatingTimer);
      expect(MockPomodoroTimer).toHaveBeenCalledTimes(1);
    });

    test('should create widget with inline styles', async () => {
      floatingTimer = new FloatingTimer();
      
      // Manually trigger the initialization flow that would normally be async
      await (floatingTimer as any).initializeWidget();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget).toBeTruthy();
      
      // Check that inline styles are applied
      expect(widget?.style.position).toBe('fixed');
      expect(widget?.style.width).toBe('280px');
      expect(widget?.style.height).toBe('50px');
      expect(widget?.style.zIndex).toBe('2147483648');
    });

    test('should create widget with proper structure', async () => {
      floatingTimer = new FloatingTimer();
      
      // Manually trigger the initialization
      await (floatingTimer as any).initializeWidget();
      
      // Verify widget was created with expected structure
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget).toBeTruthy();
      expect(widget?.querySelector('.timer-bar-content')).toBeTruthy();
      expect(widget?.querySelector('.timer-control-btn')).toBeTruthy();
      expect(widget?.querySelector('.timer-progress-container')).toBeTruthy();
    });

    test('should load settings from storage on initialization', async () => {
      const customSettings = {
        alwaysShow: true,
        position: { x: 100, y: 200 },
        minimized: true
      };
      mockStorageGetResponse = {
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: customSettings
      };
      
      floatingTimer = new FloatingTimer();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]);
    });

    test('should use default settings if storage load fails', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      
      floatingTimer = new FloatingTimer();
      
      // Should not throw error
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(floatingTimer).toBeInstanceOf(FloatingTimer);
    });
  });

  describe('Widget Creation and Management', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await (floatingTimer as any).initializeWidget();
    });

    test('should create widget element', () => {
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget).toBeTruthy();
      expect(widget?.style.position).toBe('fixed');
      expect(widget?.style.width).toBe('280px');
      expect(widget?.style.height).toBe('50px');
    });

    test('should remove existing widget when creating new one', async () => {
      const firstWidget = document.getElementById('pomoblock-floating-timer');
      expect(firstWidget).toBeTruthy();
      
      // Trigger widget recreation
      (floatingTimer as any).createWidget();
      
      const widgets = document.querySelectorAll('#pomoblock-floating-timer');
      expect(widgets).toHaveLength(1);
    });

    test('should position widget according to settings', async () => {
      // Clean up existing floatingTimer first
      if (floatingTimer) {
        floatingTimer.destroy();
      }
      
      const customSettings = {
        position: { x: 150, y: 250 }
      };
      mockStorageGetResponse = {
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: customSettings
      };
      
      const newTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.left).toBe('150px');
      expect(widget?.style.top).toBe('250px');
      
      newTimer.destroy();
    });
  });

  describe('Timer Status Updates', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await (floatingTimer as any).initializeWidget();
    });

    test('should update status and show widget when timer is active', () => {
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('flex');
      expect(mockTimerInstance.setStatusForUI).toHaveBeenCalledWith(workStatus);
    });

    test('should hide widget when timer is stopped and alwaysShow is false', () => {
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('none');
    });

    test('should show widget when timer is stopped but alwaysShow is true', () => {
      floatingTimer.setAlwaysShow(true);
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('flex');
    });

    test('should update progress bar for active timer', () => {
      mockTimerInstance.getProgressPercentage.mockReturnValue(75);
      
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 375,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const progressBar = document.querySelector('.timer-progress-bar') as HTMLElement;
      expect(progressBar?.style.width).toBe('75%');
    });
  });

  describe('Widget Content Generation', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should show play button when timer is stopped', () => {
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const playButton = document.querySelector('[data-action="start"]');
      expect(playButton).toBeTruthy();
      expect(playButton?.textContent?.includes('▶️')).toBe(true);
    });

    test('should show pause button when timer is active', () => {
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const pauseButton = document.querySelector('[data-action="pause"]');
      expect(pauseButton).toBeTruthy();
      expect(pauseButton?.textContent?.includes('⏸️')).toBe(true);
    });

    test('should show resume button when timer is paused', () => {
      const pausedStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'PAUSED',
        timeRemaining: 1200,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(pausedStatus);
      
      const resumeButton = document.querySelector('[data-action="resume"]');
      expect(resumeButton).toBeTruthy();
      expect(resumeButton?.textContent?.includes('▶️')).toBe(true);
    });

    test('should display timer information correctly', () => {
      mockTimerInstance.getDisplayTime.mockReturnValue('20:15');
      mockTimerInstance.getSessionDisplayInfo.mockReturnValue({
        sessionIcon: '🍅',
        sessionText: 'Session #2 - Work',
        sessionNumber: 2
      });
      
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1215,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const textOverlay = document.querySelector('.timer-text-overlay');
      expect(textOverlay?.textContent).toContain('🍅');
      expect(textOverlay?.textContent).toContain('20:15');
    });
  });

  describe('Widget Styling Based on Timer State', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should apply WORK styling for work sessions', () => {
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      const progressBar = document.querySelector('.timer-progress-bar') as HTMLElement;
      
      expect(widget?.style.borderColor).toBe('rgba(244, 67, 54, 0.6)');
      expect(progressBar?.style.background).toContain('#f44336');
    });

    test('should apply REST styling for rest sessions', () => {
      const restStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'REST',
        timeRemaining: 300,
        totalTime: 300
      };
      
      floatingTimer.updateStatus(restStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      const progressBar = document.querySelector('.timer-progress-bar') as HTMLElement;
      
      expect(widget?.style.borderColor).toBe('rgba(76, 175, 80, 0.6)');
      expect(progressBar?.style.background).toContain('#4CAF50');
    });

    test('should apply PAUSED styling for paused sessions', () => {
      const pausedStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'PAUSED',
        timeRemaining: 1200,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(pausedStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      const progressBar = document.querySelector('.timer-progress-bar') as HTMLElement;
      
      expect(widget?.style.borderColor).toBe('rgba(255, 152, 0, 0.6)');
      expect(progressBar?.style.background).toContain('#FF9800');
    });
  });

  describe('User Interactions', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should send start message when play button is clicked', () => {
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const playButton = document.querySelector('[data-action="start"]') as HTMLElement;
      playButton.click();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_WORK',
        task: expect.stringContaining('Work Session')
      });
    });

    test('should send pause message when pause button is clicked', () => {
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const pauseButton = document.querySelector('[data-action="pause"]') as HTMLElement;
      pauseButton.click();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PAUSE_TIMER'
      });
    });

    test('should send resume message when resume button is clicked', () => {
      const pausedStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'PAUSED',
        timeRemaining: 1200,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(pausedStatus);
      
      const resumeButton = document.querySelector('[data-action="resume"]') as HTMLElement;
      resumeButton.click();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'RESUME_TIMER'
      });
    });

    test('should hide widget when close button is clicked', () => {
      floatingTimer.setAlwaysShow(true);
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const closeButton = document.querySelector('.timer-close-btn') as HTMLElement;
      closeButton.click();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('none');
    });

    test('should start rest session when timer shows next session as REST', async () => {
      const statusWithNextRest: TimerStatus = {
        ...defaultTimerStatus,
        nextSessionType: 'REST'
      };
      
      floatingTimer.updateStatus(statusWithNextRest);
      
      const playButton = document.querySelector('[data-action="start"]') as HTMLElement;
      playButton.click();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_REST'
      });
    });
  });

  describe.skip('Drag Functionality', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should not start drag when clicking on control buttons', () => {
      const widget = document.getElementById('pomoblock-floating-timer');
      const controlButton = document.querySelector('.timer-control-btn') as HTMLElement;
      
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      });
      
      Object.defineProperty(mouseDownEvent, 'target', {
        value: controlButton,
        enumerable: true
      });
      
      controlButton.dispatchEvent(mouseDownEvent);
      
      expect(widget?.style.cursor).not.toBe('grabbing');
    });

    test('should start drag when clicking on widget background', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 50,
        top: 100,
        width: 280,
        height: 50
      });
      
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 125,
        bubbles: true
      });
      
      Object.defineProperty(mouseDownEvent, 'target', {
        value: widget,
        enumerable: true
      });
      
      widget.dispatchEvent(mouseDownEvent);
      
      expect(widget.style.cursor).toBe('grabbing');
    });

    test('should update position during drag', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 50,
        top: 100,
        width: 280,
        height: 50
      });
      
      // Mock offsetWidth and offsetHeight
      Object.defineProperty(widget, 'offsetWidth', { value: 280 });
      Object.defineProperty(widget, 'offsetHeight', { value: 50 });
      
      // Start drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 125,
        bubbles: true
      });
      
      Object.defineProperty(mouseDownEvent, 'target', {
        value: widget,
        enumerable: true
      });
      
      widget.dispatchEvent(mouseDownEvent);
      
      // Simulate mouse move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 175,
        bubbles: true
      });
      
      document.dispatchEvent(mouseMoveEvent);
      
      // Position should be updated (clientX - dragOffset.x, clientY - dragOffset.y)
      expect(widget.style.left).toBe('100px'); // 200 - 100 (offset from start)
      expect(widget.style.top).toBe('150px'); // 175 - 25 (offset from start)
    });

    test('should save settings after drag ends', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 50,
        top: 100,
        width: 280,
        height: 50
      });
      
      // Start drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 125,
        bubbles: true
      });
      
      Object.defineProperty(mouseDownEvent, 'target', {
        value: widget,
        enumerable: true
      });
      
      widget.dispatchEvent(mouseDownEvent);
      
      // End drag
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true
      });
      
      document.dispatchEvent(mouseUpEvent);
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: expect.objectContaining({
          position: expect.any(Object)
        })
      });
    });

    test('should constrain widget within viewport bounds', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 50,
        top: 100,
        width: 280,
        height: 50
      });
      
      // Mock offsetWidth and offsetHeight
      Object.defineProperty(widget, 'offsetWidth', { value: 280 });
      Object.defineProperty(widget, 'offsetHeight', { value: 50 });
      
      // Start drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 125,
        bubbles: true
      });
      
      Object.defineProperty(mouseDownEvent, 'target', {
        value: widget,
        enumerable: true
      });
      
      widget.dispatchEvent(mouseDownEvent);
      
      // Try to move beyond viewport
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 2000, // Beyond viewport width
        clientY: -50,  // Above viewport
        bubbles: true
      });
      
      document.dispatchEvent(mouseMoveEvent);
      
      // Should be constrained
      const leftValue = parseInt(widget.style.left);
      const topValue = parseInt(widget.style.top);
      
      expect(leftValue).toBeLessThanOrEqual(window.innerWidth - 280);
      expect(topValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should handle TIMER_UPDATE messages', () => {
      const spy = jest.spyOn(floatingTimer, 'updateStatus');
      
      const timerStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1400
      };
      
      mockMessageListener({
        type: 'TIMER_UPDATE',
        data: { timerStatus }
      });
      
      expect(spy).toHaveBeenCalledWith(timerStatus);
    });

    test('should handle TIMER_COMPLETE messages with vibration', () => {
      const requestStatusSpy = jest.spyOn(floatingTimer, 'requestTimerStatus');
      
      mockMessageListener({
        type: 'TIMER_COMPLETE'
      });
      
      expect(navigator.vibrate).toHaveBeenCalledWith([500, 200, 300]);
      expect(requestStatusSpy).toHaveBeenCalled();
    });

    test('should handle UPDATE_FLOATING_TIMER messages', () => {
      const spy = jest.spyOn(floatingTimer, 'setAlwaysShow');
      
      mockMessageListener({
        type: 'UPDATE_FLOATING_TIMER',
        alwaysShow: true
      });
      
      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should save settings to storage', async () => {
      await (floatingTimer as any).saveSettings();
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: expect.objectContaining({
          alwaysShow: expect.any(Boolean),
          position: expect.any(Object),
          minimized: expect.any(Boolean)
        })
      });
    });

    test('should handle settings save errors gracefully', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect((floatingTimer as any).saveSettings()).resolves.not.toThrow();
    });

    test('should load settings from storage', async () => {
      const customSettings = {
        alwaysShow: true,
        position: { x: 300, y: 400 }
      };
      
      mockStorageGetResponse = {
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: customSettings
      };
      
      await (floatingTimer as any).loadSettings();
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]);
    });

    test('should handle settings load errors gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect((floatingTimer as any).loadSettings()).resolves.not.toThrow();
    });
  });

  describe('Visibility Management', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should show widget', () => {
      floatingTimer.show();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('flex');
    });

    test('should hide widget', () => {
      floatingTimer.hide();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('none');
    });

    test('should toggle widget visibility', () => {
      const widget = document.getElementById('pomoblock-floating-timer');
      
      floatingTimer.toggle();
      expect(widget?.style.display).toBe('flex');
      
      floatingTimer.toggle();
      expect(widget?.style.display).toBe('none');
    });

    test('should respect alwaysShow setting', () => {
      floatingTimer.setAlwaysShow(true);
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.display).toBe('flex');
    });

    test('should save alwaysShow setting when changed', () => {
      floatingTimer.setAlwaysShow(false);
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: expect.objectContaining({
          alwaysShow: false
        })
      });
    });
  });

  describe('Event Listeners and Tab Management', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should refresh status when tab becomes visible', () => {
      const spy = jest.spyOn(floatingTimer, 'requestTimerStatus');
      
      // Make widget visible first
      floatingTimer.show();
      
      // Simulate tab becoming visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      expect(spy).toHaveBeenCalled();
    });

    test('should not refresh status when tab is hidden', () => {
      const spy = jest.spyOn(floatingTimer, 'requestTimerStatus');
      
      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      expect(spy).not.toHaveBeenCalled();
    });

    test('should refresh status on window focus', () => {
      const spy = jest.spyOn(floatingTimer, 'requestTimerStatus');
      
      // Make widget visible first
      floatingTimer.show();
      
      window.dispatchEvent(new Event('focus'));
      
      expect(spy).toHaveBeenCalled();
    });

    test('should adjust position on window resize', () => {
      const spy = jest.spyOn(floatingTimer as any, 'ensureWidgetPosition');
      
      // Make widget visible first
      floatingTimer.show();
      
      window.dispatchEvent(new Event('resize'));
      
      expect(spy).toHaveBeenCalled();
    });

    test('should sync position from storage changes', () => {
      const newSettings = {
        position: { x: 500, y: 600 },
        alwaysShow: false
      };
      
      mockStorageChangeListener(
        {
          [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: {
            newValue: newSettings
          }
        },
        'local'
      );
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.left).toBe('500px');
      expect(widget?.style.top).toBe('600px');
    });
  });

  describe('Vibration Effects', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should trigger haptic vibration when supported', () => {
      (floatingTimer as any).triggerVibration();
      
      expect(navigator.vibrate).toHaveBeenCalledWith([500, 200, 300]);
    });

    test('should handle haptic vibration errors gracefully', () => {
      (navigator.vibrate as jest.Mock).mockImplementation(() => {
        throw new Error('Vibration error');
      });
      
      // Should not throw
      expect(() => {
        (floatingTimer as any).triggerVibration();
      }).not.toThrow();
    });

    test('should trigger visual vibration effect', () => {
      (floatingTimer as any).triggerVisualVibration();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.animation).toBe('shake 0.6s ease-in-out');
      
      const shakeStyle = document.getElementById('pomoblock-shake-animation');
      expect(shakeStyle).toBeTruthy();
      expect(shakeStyle?.textContent).toContain('@keyframes shake');
    });

    test('should not add shake animation twice', () => {
      (floatingTimer as any).triggerVisualVibration();
      (floatingTimer as any).triggerVisualVibration();
      
      const shakeStyles = document.querySelectorAll('#pomoblock-shake-animation');
      expect(shakeStyles).toHaveLength(1);
    });

    test('should clear animation after completion', (done) => {
      (floatingTimer as any).triggerVisualVibration();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.animation).toBe('shake 0.6s ease-in-out');
      
      setTimeout(() => {
        expect(widget?.style.animation).toBe('');
        done();
      }, 700);
    });
  });

  describe('Position Management', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should ensure widget stays within viewport bounds', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect to simulate widget outside viewport
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: -50,
        top: -25,
        right: 230,
        bottom: 25,
        width: 280,
        height: 50
      });
      
      // Mock offsetWidth and offsetHeight
      Object.defineProperty(widget, 'offsetWidth', { value: 280 });
      Object.defineProperty(widget, 'offsetHeight', { value: 50 });
      
      (floatingTimer as any).ensureWidgetPosition();
      
      expect(widget.style.left).toBe('10px');
      expect(widget.style.top).toBe('10px');
    });

    test('should adjust position when widget extends beyond right edge', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect to simulate widget beyond right edge
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 1700,
        top: 100,
        right: 1980, // Beyond viewport width of 1920
        bottom: 150,
        width: 280,
        height: 50
      });
      
      Object.defineProperty(widget, 'offsetWidth', { value: 280 });
      Object.defineProperty(widget, 'offsetHeight', { value: 50 });
      
      (floatingTimer as any).ensureWidgetPosition();
      
      const leftValue = parseInt(widget.style.left);
      expect(leftValue).toBeLessThanOrEqual(1920 - 280 - 10);
    });

    test('should adjust position when widget extends beyond bottom edge', () => {
      const widget = document.getElementById('pomoblock-floating-timer') as HTMLElement;
      
      // Mock getBoundingClientRect to simulate widget beyond bottom edge
      widget.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 100,
        top: 1050,
        right: 380,
        bottom: 1100, // Beyond viewport height of 1080
        width: 280,
        height: 50
      });
      
      Object.defineProperty(widget, 'offsetWidth', { value: 280 });
      Object.defineProperty(widget, 'offsetHeight', { value: 50 });
      
      (floatingTimer as any).ensureWidgetPosition();
      
      const topValue = parseInt(widget.style.top);
      expect(topValue).toBeLessThanOrEqual(1080 - 50 - 10);
    });
  });

  describe.skip('Extension Reload Handling', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should handle extension context invalidated error', async () => {
      const contextError = new Error('Extension context invalidated');
      mockChrome.runtime.sendMessage.mockRejectedValue(contextError);
      
      const spy = jest.spyOn(floatingTimer as any, 'handleExtensionReload');
      
      await floatingTimer.requestTimerStatus();
      
      expect(spy).toHaveBeenCalled();
    });

    test('should attempt to reconnect after extension reload', (done) => {
      const spy = jest.spyOn(floatingTimer, 'requestTimerStatus');
      
      (floatingTimer as any).handleExtensionReload();
      
      setTimeout(() => {
        expect(spy).toHaveBeenCalled();
        done();
      }, 1100);
    });

    test('should handle extension reload gracefully', async () => {
      // Mock chrome.runtime.sendMessage to reject (simulating disconnection)
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Still disconnected'));
      
      const spy = jest.spyOn(floatingTimer, 'hide');
      
      // Test that handleExtensionReload doesn't throw
      expect(() => {
        (floatingTimer as any).handleExtensionReload();
      }).not.toThrow();
      
      // Verify the method exists and is callable
      expect(typeof (floatingTimer as any).handleExtensionReload).toBe('function');
    });
  });

  describe('Blocked Page Event Handling', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should ensure visibility when blocked page is displayed', () => {
      const spy = jest.spyOn(floatingTimer as any, 'ensureVisibilityOnBlockedPage');
      
      window.dispatchEvent(new CustomEvent('pomoblock-page-blocked', {
        detail: { blocked: true, timerState: 'WORK' }
      }));
      
      expect(spy).toHaveBeenCalled();
    });

    test('should force widget visibility when timer is active on blocked page', () => {
      const workStatus: TimerStatus = {
        ...defaultTimerStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500
      };
      
      floatingTimer.updateStatus(workStatus);
      
      const spy = jest.spyOn(floatingTimer, 'show');
      (floatingTimer as any).ensureVisibilityOnBlockedPage();
      
      expect(spy).toHaveBeenCalled();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget?.style.zIndex).toBe('2147483648');
      expect(widget?.style.position).toBe('fixed');
    });

    test('should create widget if it does not exist on blocked page', () => {
      // Remove widget by setting it to null in the instance
      (floatingTimer as any).widget = null;
      
      const createWidgetSpy = jest.spyOn(floatingTimer as any, 'createWidget');
      
      (floatingTimer as any).ensureVisibilityOnBlockedPage();
      
      expect(createWidgetSpy).toHaveBeenCalled();
    });

    test('should force visibility when alwaysShow is enabled on blocked page', () => {
      floatingTimer.setAlwaysShow(true);
      floatingTimer.updateStatus(defaultTimerStatus);
      
      const spy = jest.spyOn(floatingTimer, 'show');
      (floatingTimer as any).ensureVisibilityOnBlockedPage();
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Destruction', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should remove widget on destroy', () => {
      floatingTimer.destroy();
      
      const widget = document.getElementById('pomoblock-floating-timer');
      expect(widget).toBeNull();
      expect(mockTimerInstance.destroy).toHaveBeenCalled();
    });

    test('should handle destroy when widget does not exist', () => {
      // Remove widget first
      const widget = document.getElementById('pomoblock-floating-timer');
      widget?.remove();
      
      // Should not throw
      expect(() => {
        floatingTimer.destroy();
      }).not.toThrow();
    });
  });

  describe('Initialize Method', () => {
    test('should initialize widget and request status', async () => {
      floatingTimer = new FloatingTimer();
      
      const requestStatusSpy = jest.spyOn(floatingTimer, 'requestTimerStatus');
      const showSpy = jest.spyOn(floatingTimer, 'show');
      
      // Set alwaysShow to true to test visibility
      mockStorageGetResponse = {
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: { alwaysShow: true }
      };
      
      await floatingTimer.initialize();
      
      expect(requestStatusSpy).toHaveBeenCalled();
      expect(showSpy).toHaveBeenCalled();
    });

    test('should not show widget if alwaysShow is false', async () => {
      floatingTimer = new FloatingTimer();
      
      const showSpy = jest.spyOn(floatingTimer, 'show');
      
      // Set alwaysShow to false
      mockStorageGetResponse = {
        [POMODORO_STORAGE_KEYS.FLOATING_TIMER_SETTINGS]: { alwaysShow: false }
      };
      
      await floatingTimer.initialize();
      
      expect(showSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      floatingTimer = new FloatingTimer();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('should handle sendMessage errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Send error'));
      
      // Should not throw
      await expect((floatingTimer as any).sendMessage('TEST_MESSAGE')).resolves.not.toThrow();
    });

    test('should handle requestTimerStatus errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Request error'));
      
      // Should not throw
      await expect(floatingTimer.requestTimerStatus()).resolves.not.toThrow();
    });

    test('should handle handleStartAction errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Start error'));
      
      floatingTimer.updateStatus(defaultTimerStatus);
      
      // Should not throw
      await expect((floatingTimer as any).handleStartAction()).resolves.not.toThrow();
    });
  });
});