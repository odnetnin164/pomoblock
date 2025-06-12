import { Logger, logger } from '@shared/logger';
import { DEBUG_CONFIG } from '@shared/constants';

// Mock DOM
const mockElement = {
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  children: [] as any[],
  remove: jest.fn(),
  style: {},
  textContent: '',
  addEventListener: jest.fn()
};

const mockDocument = {
  createElement: jest.fn(() => mockElement),
  documentElement: {
    appendChild: jest.fn()
  }
};

const mockWindow = {};

describe.skip('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElement.children = [];
    (global as any).document = mockDocument;
    (global as any).window = mockWindow;
  });

  afterEach(() => {
    delete (global as any).document;
    delete (global as any).window;
  });

  describe('Constructor', () => {
    test('should create logger with debug disabled by default', () => {
      const testLogger = new Logger();
      
      expect(testLogger.getLogs()).toEqual([]);
    });

    test('should create logger with debug enabled when specified', () => {
      const testLogger = new Logger(true);
      
      expect(testLogger.getLogs()).toEqual([]);
    });

    test('should detect service worker context when window is undefined', () => {
      delete (global as any).window;
      delete (global as any).document;
      
      const testLogger = new Logger(true);
      testLogger.log('test message');
      
      // Should not attempt to create DOM elements
      expect(mockDocument.createElement).not.toHaveBeenCalled();
    });
  });

  describe('setDebugEnabled', () => {
    test('should enable debug mode', () => {
      const testLogger = new Logger(false);
      
      testLogger.setDebugEnabled(true);
      testLogger.log('test message');
      
      // Should attempt to create debug div
      expect(mockDocument.createElement).toHaveBeenCalled();
    });

    test('should disable debug mode and remove debug div', () => {
      const testLogger = new Logger(true);
      testLogger.log('initial message'); // Creates debug div
      
      testLogger.setDebugEnabled(false);
      
      expect(mockElement.remove).toHaveBeenCalled();
    });

    test('should not remove debug div in service worker context', () => {
      delete (global as any).window;
      delete (global as any).document;
      
      const testLogger = new Logger(true);
      testLogger.setDebugEnabled(false);
      
      expect(mockElement.remove).not.toHaveBeenCalled();
    });
  });

  describe('log', () => {
    test('should add log entry to internal logs', () => {
      const testLogger = new Logger();
      const message = 'test message';
      const data = { key: 'value' };
      
      testLogger.log(message, data);
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe(message);
      expect(logs[0].data).toEqual(data);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    test('should maintain maximum log entries', () => {
      const testLogger = new Logger();
      
      // Add more than maximum entries
      for (let i = 0; i < DEBUG_CONFIG.MAX_LOG_ENTRIES + 5; i++) {
        testLogger.log(`message ${i}`);
      }
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(DEBUG_CONFIG.MAX_LOG_ENTRIES);
      expect(logs[0].message).toBe(`message 5`); // First 5 should be removed
    });

    test('should show visual log when debug enabled and not in service worker', () => {
      const testLogger = new Logger(true);
      
      testLogger.log('test message');
      
      expect(mockDocument.createElement).toHaveBeenCalled();
      expect(mockElement.appendChild).toHaveBeenCalled();
    });

    test('should not show visual log when debug disabled', () => {
      const testLogger = new Logger(false);
      
      testLogger.log('test message');
      
      expect(mockDocument.createElement).not.toHaveBeenCalled();
    });

    test('should not show visual log in service worker context', () => {
      delete (global as any).window;
      delete (global as any).document;
      
      const testLogger = new Logger(true);
      testLogger.log('test message');
      
      expect(mockDocument.createElement).not.toHaveBeenCalled();
    });

    test('should handle log without data', () => {
      const testLogger = new Logger();
      
      testLogger.log('message without data');
      
      const logs = testLogger.getLogs();
      expect(logs[0].data).toBeUndefined();
    });
  });

  describe('showVisualLog', () => {
    test('should create debug div if it does not exist', () => {
      const testLogger = new Logger(true);
      
      testLogger.log('test message');
      
      expect(mockDocument.createElement).toHaveBeenCalled();
      expect(mockDocument.documentElement.appendChild).toHaveBeenCalled();
    });

    test('should reuse existing debug div', () => {
      const testLogger = new Logger(true);
      
      testLogger.log('first message');
      testLogger.log('second message');
      
      // Should only create the div once
      expect(mockDocument.documentElement.appendChild).toHaveBeenCalledTimes(1);
    });

    test('should maintain maximum visual log entries', () => {
      const testLogger = new Logger(true);
      
      // Mock children array to simulate DOM structure
      mockElement.children = new Array(DEBUG_CONFIG.MAX_LOG_ENTRIES + 2).fill(mockElement);
      
      testLogger.log('test message');
      
      expect(mockElement.removeChild).toHaveBeenCalled();
    });

    test('should handle DOM operation errors gracefully', () => {
      const testLogger = new Logger(true);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockDocument.createElement.mockImplementation(() => {
        throw new Error('DOM error');
      });
      
      expect(() => testLogger.log('test message')).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not show visual debug log:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('createDebugDiv', () => {
    test('should throw error in service worker context', () => {
      delete (global as any).window;
      delete (global as any).document;
      
      const testLogger = new Logger(true);
      
      expect(() => {
        // Access private method for testing
        (testLogger as any).createDebugDiv();
      }).toThrow('Cannot create debug div in service worker context');
    });

    test('should create debug div with proper styling', () => {
      const testLogger = new Logger(true);
      
      testLogger.log('test message'); // Triggers debug div creation
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.appendChild).toHaveBeenCalled();
    });

    test('should add close button functionality', () => {
      const testLogger = new Logger(true);
      
      testLogger.log('test message');
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('getLogs', () => {
    test('should return copy of logs array', () => {
      const testLogger = new Logger();
      
      testLogger.log('message 1');
      testLogger.log('message 2');
      
      const logs1 = testLogger.getLogs();
      const logs2 = testLogger.getLogs();
      
      expect(logs1).toEqual(logs2);
      expect(logs1).not.toBe(logs2); // Should be different array instances
    });

    test('should return empty array when no logs', () => {
      const testLogger = new Logger();
      
      expect(testLogger.getLogs()).toEqual([]);
    });
  });

  describe('clearLogs', () => {
    test('should clear internal logs', () => {
      const testLogger = new Logger();
      
      testLogger.log('message 1');
      testLogger.log('message 2');
      
      expect(testLogger.getLogs()).toHaveLength(2);
      
      testLogger.clearLogs();
      
      expect(testLogger.getLogs()).toHaveLength(0);
    });

    test('should clear visual logs when debug div exists', () => {
      const testLogger = new Logger(true);
      
      // Mock children to simulate title, close button, and log entries
      mockElement.children = new Array(5).fill(mockElement);
      
      testLogger.clearLogs();
      
      expect(mockElement.removeChild).toHaveBeenCalledTimes(3); // Remove 3 log entries, keep title and close button
    });

    test('should not attempt to clear visual logs in service worker', () => {
      delete (global as any).window;
      delete (global as any).document;
      
      const testLogger = new Logger(true);
      testLogger.log('message'); // Add a log entry
      testLogger.clearLogs();
      
      expect(mockElement.removeChild).not.toHaveBeenCalled();
    });
  });

  describe('Default logger instance', () => {
    test('should export a default logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    test('should be able to use default logger', () => {
      logger.log('test message');
      
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].message).toBe('test message');
      
      // Clean up
      logger.clearLogs();
    });
  });
});