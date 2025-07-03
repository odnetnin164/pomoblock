// Test setup file
import 'jest';

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock Chrome APIs
(global as any).chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      onChanged: {
        addListener: jest.fn()
      }
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://test/${path}`)
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    sendMessage: jest.fn()
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    openPopup: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  notifications: {
    create: jest.fn()
  }
};

// Mock DOM globals for jsdom - simple approach
// Individual tests will override window.location as needed

// Prevent jsdom navigation errors during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: any[]) => {
    if (args[0] && args[0].message && args[0].message.includes('Not implemented: navigation')) {
      return; // suppress navigation errors
    }
    originalConsoleError.apply(console, args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
});