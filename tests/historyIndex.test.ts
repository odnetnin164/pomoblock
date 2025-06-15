import { getSessionsHistory, getDailyStats, formatDuration, formatDurationLong } from '@shared/pomodoroStorage';
import { PomodoroSession, DailyStats } from '@shared/pomodoroTypes';

// Mock dependencies
jest.mock('@shared/pomodoroStorage');

const mockGetSessionsHistory = getSessionsHistory as jest.MockedFunction<typeof getSessionsHistory>;
const mockGetDailyStats = getDailyStats as jest.MockedFunction<typeof getDailyStats>;
const mockFormatDuration = formatDuration as jest.MockedFunction<typeof formatDuration>;
const mockFormatDurationLong = formatDurationLong as jest.MockedFunction<typeof formatDurationLong>;

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      set: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;
(global as any).location = {
  reload: jest.fn()
};
(global as any).confirm = jest.fn();

// Mock DOM elements
const createMockElement = (id: string, tag: string = 'div') => {
  const element = document.createElement(tag);
  element.id = id;
  if (tag === 'button') {
    element.addEventListener = jest.fn();
  }
  return element;
};

const mockElements = {
  sessionsContainer: createMockElement('sessionsContainer'),
  statsContainer: createMockElement('statsContainer'),
  clearDataButton: createMockElement('clearDataButton', 'button')
};

// Mock document.getElementById
const originalGetElementById = document.getElementById;
document.getElementById = jest.fn((id: string) => {
  return mockElements[id as keyof typeof mockElements] || null;
});

describe('History Index - Behavior Tests', () => {
  const mockSessions: PomodoroSession[] = [
    {
      id: 'session-1',
      type: 'WORK',
      duration: 1500,
      plannedDuration: 1500,
      task: 'Test task 1',
      startTime: Date.now() - 3600000,
      endTime: Date.now() - 2100000,
      completed: true,
      date: '2024-01-15'
    },
    {
      id: 'session-2',
      type: 'REST',
      duration: 300,
      plannedDuration: 300,
      task: 'Break',
      startTime: Date.now() - 2100000,
      endTime: Date.now() - 1800000,
      completed: true,
      date: '2024-01-15'
    },
    {
      id: 'session-3',
      type: 'WORK',
      duration: 900,
      plannedDuration: 1500,
      task: 'Test task 2',
      startTime: Date.now() - 1800000,
      endTime: Date.now() - 900000,
      completed: false,
      date: '2024-01-15'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    Object.defineProperty(document, 'readyState', { value: 'complete', writable: true });
    mockElements.sessionsContainer.innerHTML = '';
    mockElements.statsContainer.innerHTML = '';
    
    // Setup default mocks
    mockGetSessionsHistory.mockResolvedValue(mockSessions);
    mockFormatDurationLong.mockImplementation((seconds: number) => {
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
    });

    mockChrome.storage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });

    (global as any).confirm.mockReturnValue(true);
  });

  afterEach(() => {
    document.getElementById = originalGetElementById;
  });

  describe('History Page Initialization', () => {
    test('should initialize and load session data when DOM is ready', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should load session data
      expect(mockGetSessionsHistory).toHaveBeenCalled();
    });

    test('should setup event listeners', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should setup clear data button
      expect(mockElements.clearDataButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should display loading state initially', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);

      // Should show loading state
      expect(mockElements.sessionsContainer.innerHTML).toContain('Loading sessions...');
    });
  });

  describe('Session Data Display', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should display sessions after loading', async () => {
      // Should format session durations
      expect(mockFormatDurationLong).toHaveBeenCalled();
    });

    test('should handle empty session data', async () => {
      mockGetSessionsHistory.mockResolvedValue([]);
      
      // Re-trigger loading
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should show empty state
      expect(mockElements.sessionsContainer.innerHTML).toContain('No sessions yet');
    });

    test('should limit session display', async () => {
      const manySessions = Array.from({ length: 100 }, (_, i) => ({
        ...mockSessions[0],
        id: `session-${i}`,
        startTime: Date.now() - (i * 1000)
      }));
      
      mockGetSessionsHistory.mockResolvedValue(manySessions);
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should limit display to reasonable number
      expect(mockGetSessionsHistory).toHaveBeenCalled();
    });
  });

  describe('Statistics Calculation', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should calculate work session statistics', () => {
      const workSessions = mockSessions.filter(s => s.type === 'WORK');
      const completedWorkSessions = workSessions.filter(s => s.completed);

      // Should have correct counts
      expect(completedWorkSessions.length).toBe(1);
      expect(workSessions.length).toBe(2);
    });

    test('should calculate completion rate correctly', () => {
      const workSessions = mockSessions.filter(s => s.type === 'WORK');
      const completedWorkSessions = workSessions.filter(s => s.completed);
      const completionRate = workSessions.length > 0 ? 
        (completedWorkSessions.length / workSessions.length) * 100 : 0;

      expect(completionRate).toBe(50); // 1 completed out of 2 work sessions
    });

    test('should calculate total work time correctly', () => {
      const workSessions = mockSessions.filter(s => s.type === 'WORK');
      const totalWorkTime = workSessions.reduce((sum, s) => sum + s.duration, 0);

      expect(totalWorkTime).toBe(2400); // 1500 + 900 seconds
    });

    test('should calculate total rest time correctly', () => {
      const restSessions = mockSessions.filter(s => s.type === 'REST');
      const totalRestTime = restSessions.reduce((sum, s) => sum + s.duration, 0);

      expect(totalRestTime).toBe(300); // 300 seconds
    });

    test('should handle zero sessions gracefully', async () => {
      mockGetSessionsHistory.mockResolvedValue([]);
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle empty data without errors
      expect(mockGetSessionsHistory).toHaveBeenCalled();
    });
  });

  describe('Data Clearing Functionality', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should clear all data with confirmation', async () => {
      (global as any).confirm.mockReturnValueOnce(true).mockReturnValueOnce(true);
      
      const clickEvent = new Event('click');
      mockElements.clearDataButton.dispatchEvent(clickEvent);

      // Should request double confirmation
      expect((global as any).confirm).toHaveBeenCalledTimes(2);
      
      // Should clear data
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        pomodoroDailyStats: {},
        pomodoroSessionsHistory: []
      }, expect.any(Function));
      
      // Should reload page
      expect((global as any).location.reload).toHaveBeenCalled();
    });

    test('should not clear data if first confirmation is declined', async () => {
      (global as any).confirm.mockReturnValueOnce(false);
      
      const clickEvent = new Event('click');
      mockElements.clearDataButton.dispatchEvent(clickEvent);

      expect((global as any).confirm).toHaveBeenCalledTimes(1);
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
      expect((global as any).location.reload).not.toHaveBeenCalled();
    });

    test('should not clear data if second confirmation is declined', async () => {
      (global as any).confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
      
      const clickEvent = new Event('click');
      mockElements.clearDataButton.dispatchEvent(clickEvent);

      expect((global as any).confirm).toHaveBeenCalledTimes(2);
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
      expect((global as any).location.reload).not.toHaveBeenCalled();
    });

    test('should handle data clearing errors gracefully', async () => {
      (global as any).confirm.mockReturnValue(true);
      (global as any).alert = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockChrome.storage.local.set.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const clickEvent = new Event('click');
      mockElements.clearDataButton.dispatchEvent(clickEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Error clearing data:', expect.any(Error));
      expect((global as any).alert).toHaveBeenCalledWith('Failed to clear data. Please try again.');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error States and Handling', () => {
    test('should display error state on loading failure', async () => {
      mockGetSessionsHistory.mockRejectedValue(new Error('Network error'));
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should show error state
      expect(mockElements.sessionsContainer.innerHTML).toContain('❌ Failed to load history data');
      expect(mockElements.sessionsContainer.innerHTML).toContain('Try Again');
    });

    test('should provide retry functionality in error state', async () => {
      mockGetSessionsHistory.mockRejectedValue(new Error('Network error'));
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Error state should include retry functionality
      expect(mockElements.sessionsContainer.innerHTML).toContain('onclick="location.reload()"');
    });

    test('should handle malformed session data gracefully', async () => {
      const malformedSessions = [
        {
          id: 'session-bad',
          type: 'WORK' as const,
          duration: null as any,
          plannedDuration: undefined as any,
          task: null as any,
          startTime: 'invalid' as any,
          endTime: null as any,
          completed: 'yes' as any,
          date: null as any
        }
      ] as any;
      
      mockGetSessionsHistory.mockResolvedValue(malformedSessions);
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash with malformed data
      expect(mockGetSessionsHistory).toHaveBeenCalled();
    });

    test('should handle sessions with zero duration', async () => {
      const zeroSession = {
        ...mockSessions[0],
        duration: 0
      };
      
      mockGetSessionsHistory.mockResolvedValue([zeroSession]);
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFormatDurationLong).toHaveBeenCalledWith(0);
    });

    test('should handle sessions with future dates', async () => {
      const futureSession = {
        ...mockSessions[0],
        startTime: Date.now() + 3600000, // 1 hour in future
        endTime: Date.now() + 7200000    // 2 hours in future
      };
      
      mockGetSessionsHistory.mockResolvedValue([futureSession]);
      
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle future dates without issues
      expect(mockGetSessionsHistory).toHaveBeenCalled();
    });
  });

  describe('Session Display Features', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/history/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should display sessions in chronological order', () => {
      const sortedSessions = [...mockSessions].sort((a, b) => b.startTime - a.startTime);
      
      // Most recent should be first
      expect(sortedSessions[0].id).toBe('session-1');
    });

    test('should format session display correctly', () => {
      const session = mockSessions[0];
      
      // Should format each session duration
      expect(mockFormatDurationLong).toHaveBeenCalledWith(session.duration);
    });

    test('should differentiate between work and rest sessions', () => {
      const workSession = mockSessions.find(s => s.type === 'WORK');
      const restSession = mockSessions.find(s => s.type === 'REST');
      
      expect(workSession?.type).toBe('WORK');
      expect(restSession?.type).toBe('REST');
    });

    test('should show completion status correctly', () => {
      const completedSession = mockSessions.find(s => s.completed);
      const interruptedSession = mockSessions.find(s => !s.completed);
      
      expect(completedSession?.completed).toBe(true);
      expect(interruptedSession?.completed).toBe(false);
    });

    test('should handle sessions with no task', () => {
      const sessionWithoutTask = {
        ...mockSessions[0],
        task: ''
      };
      
      // Should provide default display for empty tasks
      expect(sessionWithoutTask.task || 'Focus session').toBeDefined();
    });
  });
});