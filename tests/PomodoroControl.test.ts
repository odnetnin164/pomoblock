import { PomodoroControl } from '@popup/components/PomodoroControl';
import { TimerStatus } from '@shared/pomodoroTypes';
import { PomodoroTimer } from '@shared/pomodoroTimer';

// Mock dependencies
jest.mock('@shared/pomodoroTimer');
jest.mock('@shared/pomodoroStorage', () => ({
  formatDuration: jest.fn((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  })
}));

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({ status: {} }),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;
(global as any).confirm = jest.fn();

const MockPomodoroTimer = PomodoroTimer as jest.MockedClass<typeof PomodoroTimer>;

describe('PomodoroControl', () => {
  let control: PomodoroControl;
  let mockTimer: jest.Mocked<PomodoroTimer>;
  let container: HTMLElement;

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
    // Setup DOM
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container')!;

    // Setup timer mock
    mockTimer = {
      setStatusForUI: jest.fn(),
      getDisplayTime: jest.fn().mockReturnValue('25:00'),
      shouldDisableTaskInput: jest.fn().mockReturnValue(false),
      getTaskInputPlaceholder: jest.fn().mockReturnValue('What are you working on?'),
      getTaskInputValue: jest.fn().mockReturnValue(''),
      getSessionDisplayInfo: jest.fn().mockReturnValue({
        sessionText: '#1 - Work',
        sessionIcon: '🍅',
        sessionNumber: 1
      }),
      getProgressPercentage: jest.fn().mockReturnValue(0),
      destroy: jest.fn()
    } as any;

    MockPomodoroTimer.mockImplementation(() => mockTimer);

    jest.clearAllMocks();
    mockChrome.runtime.sendMessage.mockResolvedValue({ status: defaultStatus });
  });

  afterEach(() => {
    if (control) {
      control.destroy();
    }
    jest.clearAllTimers();
  });

  describe('Constructor and Initialization', () => {
    test('should create pomodoro control UI', () => {
      control = new PomodoroControl('test-container');
      
      expect(container.querySelector('.pomodoro-container')).toBeTruthy();
      expect(container.querySelector('#timerDisplay')).toBeTruthy();
      expect(container.querySelector('#taskInput')).toBeTruthy();
      expect(container.querySelector('#playPauseBtn')).toBeTruthy();
      expect(container.querySelector('#stopBtn')).toBeTruthy();
    });

    test('should setup message listener', () => {
      control = new PomodoroControl('test-container');
      
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should load current status on initialization', async () => {
      control = new PomodoroControl('test-container');
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TIMER_STATUS' });
    });

    test('should start status polling', () => {
      jest.useFakeTimers();
      
      control = new PomodoroControl('test-container');
      
      // Fast forward 1 second
      jest.advanceTimersByTime(1000);
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TIMER_STATUS' });
      
      jest.useRealTimers();
    });
  });

  describe('UI Updates', () => {
    beforeEach(() => {
      control = new PomodoroControl('test-container');
    });

    test('should update status display when stopped', () => {
      control['updateStatus'](defaultStatus);
      
      const timerDisplay = container.querySelector('#timerDisplay') as HTMLElement;
      const sessionCounter = container.querySelector('#sessionCounter') as HTMLElement;
      
      expect(mockTimer.getDisplayTime).toHaveBeenCalled();
      expect(sessionCounter.textContent).toContain('0 sessions completed');
    });

    test('should update status display when running', () => {
      const workStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 1500,
        totalTime: 1500,
        currentTask: 'Test task'
      };
      
      control['updateStatus'](workStatus);
      
      const timerDisplay = container.querySelector('#timerDisplay') as HTMLElement;
      const taskInput = container.querySelector('#taskInput') as HTMLInputElement;
      
      expect(timerDisplay.textContent).toBe('25:00');
      expect(taskInput.value).toBe('Test task');
    });

    test('should update controls based on timer state', () => {
      const playPauseBtn = container.querySelector('#playPauseBtn') as HTMLButtonElement;
      const stopBtn = container.querySelector('#stopBtn') as HTMLButtonElement;
      
      // Test WORK state
      const workStatus: TimerStatus = { ...defaultStatus, state: 'WORK' };
      control['updateStatus'](workStatus);
      
      expect(playPauseBtn.innerHTML).toContain('⏸');
      expect(playPauseBtn.className).toContain('pause-btn');
      expect(stopBtn.disabled).toBe(false);
      
      // Test PAUSED state
      const pausedStatus: TimerStatus = { ...defaultStatus, state: 'PAUSED' };
      control['updateStatus'](pausedStatus);
      
      expect(playPauseBtn.innerHTML).toContain('▶');
      expect(playPauseBtn.className).toContain('play-btn');
    });

    test('should update container styling based on timer state', () => {
      const workStatus: TimerStatus = { ...defaultStatus, state: 'WORK' };
      control['updateStatus'](workStatus);
      
      expect(container.classList.contains('timer-work')).toBe(true);
      
      const restStatus: TimerStatus = { ...defaultStatus, state: 'REST' };
      control['updateStatus'](restStatus);
      
      expect(container.classList.contains('timer-rest')).toBe(true);
      expect(container.classList.contains('timer-work')).toBe(false);
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      control = new PomodoroControl('test-container');
    });

    test('should start work timer when play button clicked and stopped', async () => {
      const playPauseBtn = container.querySelector('#playPauseBtn') as HTMLButtonElement;
      const taskInput = container.querySelector('#taskInput') as HTMLInputElement;
      
      taskInput.value = 'Test task';
      
      playPauseBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_WORK',
        task: 'Test task'
      });
    });

    test('should start rest timer when next session is rest', async () => {
      const restStatus: TimerStatus = { ...defaultStatus, nextSessionType: 'REST' };
      control['updateStatus'](restStatus);
      
      const playPauseBtn = container.querySelector('#playPauseBtn') as HTMLButtonElement;
      
      playPauseBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_REST'
      });
    });

    test('should pause timer when running and play button clicked', async () => {
      const workStatus: TimerStatus = { ...defaultStatus, state: 'WORK' };
      control['updateStatus'](workStatus);
      
      const playPauseBtn = container.querySelector('#playPauseBtn') as HTMLButtonElement;
      
      playPauseBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PAUSE_TIMER'
      });
    });

    test('should resume timer when paused and play button clicked', async () => {
      const pausedStatus: TimerStatus = { ...defaultStatus, state: 'PAUSED' };
      control['updateStatus'](pausedStatus);
      
      const playPauseBtn = container.querySelector('#playPauseBtn') as HTMLButtonElement;
      
      playPauseBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'RESUME_TIMER'
      });
    });

    test('should stop timer when stop button clicked and confirmed', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      
      const workStatus: TimerStatus = { ...defaultStatus, state: 'WORK' };
      control['updateStatus'](workStatus);
      
      const stopBtn = container.querySelector('#stopBtn') as HTMLButtonElement;
      
      stopBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'STOP_TIMER'
      });
    });

    test('should not stop timer if not confirmed', async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);
      
      const stopBtn = container.querySelector('#stopBtn') as HTMLButtonElement;
      
      stopBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalledWith({
        type: 'STOP_TIMER'
      });
    });

    test('should update task when input changes', async () => {
      const taskInput = container.querySelector('#taskInput') as HTMLInputElement;
      
      taskInput.value = 'New task';
      taskInput.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_TASK',
        task: 'New task'
      });
    });

    test('should start timer when Enter key pressed in task input', async () => {
      const taskInput = container.querySelector('#taskInput') as HTMLInputElement;
      
      taskInput.value = 'Enter task';
      
      const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
      taskInput.dispatchEvent(enterEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'START_WORK',
        task: 'Enter task'
      });
    });

    test('should advance to next session when next button clicked', async () => {
      const nextBtn = container.querySelector('#nextBtn') as HTMLButtonElement;
      
      nextBtn.click();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ADVANCE_SESSION'
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      control = new PomodoroControl('test-container');
    });

    test('should handle TIMER_UPDATE message', () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const newStatus: TimerStatus = { ...defaultStatus, state: 'WORK' };
      
      const updateStatusSpy = jest.spyOn(control as any, 'updateStatus');
      
      messageListener({
        type: 'TIMER_UPDATE',
        data: { timerStatus: newStatus }
      }, {}, jest.fn());
      
      expect(updateStatusSpy).toHaveBeenCalledWith(newStatus);
    });

    test('should handle TIMER_COMPLETE message', () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      const loadCurrentStatusSpy = jest.spyOn(control as any, 'loadCurrentStatus');
      
      messageListener({
        type: 'TIMER_COMPLETE'
      }, {}, jest.fn());
      
      expect(loadCurrentStatusSpy).toHaveBeenCalled();
    });

    test('should handle TIMER_INITIALIZATION_COMPLETE message', () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const newStatus: TimerStatus = { ...defaultStatus, sessionCount: 3 };
      
      const updateStatusSpy = jest.spyOn(control as any, 'updateStatus');
      
      messageListener({
        type: 'TIMER_INITIALIZATION_COMPLETE',
        data: { timerStatus: newStatus }
      }, {}, jest.fn());
      
      expect(updateStatusSpy).toHaveBeenCalledWith(newStatus);
    });
  });

  describe('Progress Bar', () => {
    beforeEach(() => {
      control = new PomodoroControl('test-container');
    });

    test('should update circular progress', () => {
      const progressBar = container.querySelector('#progressBar') as SVGElement;
      
      control['updateCircularProgress'](50);
      
      // Calculate expected offset for 50%
      const circumference = 2 * Math.PI * 72;
      const expectedOffset = circumference - (50 / 100) * circumference;
      
      expect(progressBar.style.strokeDashoffset).toBe(expectedOffset.toString());
    });

    test('should update progress bar with timer status', () => {
      mockTimer.getProgressPercentage.mockReturnValue(75);
      
      const workStatus: TimerStatus = {
        ...defaultStatus,
        state: 'WORK',
        timeRemaining: 375, // 25% of 1500 seconds
        totalTime: 1500
      };
      
      control['updateStatus'](workStatus);
      
      expect(mockTimer.getProgressPercentage).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      control = new PomodoroControl('test-container');
    });

    test('should check if timer is blocking', () => {
      control['currentStatus'] = { ...defaultStatus, state: 'WORK' };
      expect(control.isBlocking()).toBe(true);
      
      control['currentStatus'] = { ...defaultStatus, state: 'REST' };
      expect(control.isBlocking()).toBe(false);
      
      control['currentStatus'] = { ...defaultStatus, state: 'STOPPED' };
      expect(control.isBlocking()).toBe(false);
    });

    test('should return current status', () => {
      const testStatus = { ...defaultStatus, sessionCount: 5 };
      control['currentStatus'] = testStatus;
      
      expect(control.getStatus()).toEqual(testStatus);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on destroy', () => {
      jest.useFakeTimers();
      
      control = new PomodoroControl('test-container');
      
      control.destroy();
      
      expect(mockTimer.destroy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('should handle page visibility changes', () => {
      control = new PomodoroControl('test-container');
      
      const loadCurrentStatusSpy = jest.spyOn(control as any, 'loadCurrentStatus');
      
      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
      
      expect(loadCurrentStatusSpy).toHaveBeenCalled();
    });
  });
});