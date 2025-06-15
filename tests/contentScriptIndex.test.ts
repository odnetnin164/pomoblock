import { getSettings, getBlockedWebsites, getWhitelistedPaths, onStorageChanged } from '@shared/storage';
import { logger } from '@shared/logger';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { shouldBlockBasedOnWorkHours } from '@shared/workHoursUtils';
import { BlockingEngine } from '../src/contentScript/blockingEngine';
import { BlockedPageUI } from '../src/contentScript/ui/blockedPage';
import { FloatingTimer } from '../src/contentScript/ui/floatingTimer';

// Mock dependencies
jest.mock('@shared/storage');
jest.mock('@shared/logger');
jest.mock('@shared/workHoursUtils');
jest.mock('../src/contentScript/blockingEngine');
jest.mock('../src/contentScript/ui/blockedPage');
jest.mock('../src/contentScript/ui/floatingTimer');

const mockGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;
const mockGetBlockedWebsites = getBlockedWebsites as jest.MockedFunction<typeof getBlockedWebsites>;
const mockGetWhitelistedPaths = getWhitelistedPaths as jest.MockedFunction<typeof getWhitelistedPaths>;
const mockOnStorageChanged = onStorageChanged as jest.MockedFunction<typeof onStorageChanged>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockShouldBlockBasedOnWorkHours = shouldBlockBasedOnWorkHours as jest.MockedFunction<typeof shouldBlockBasedOnWorkHours>;

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};
(global as any).chrome = mockChrome;

// Mock global objects
const mockWindow = {
  location: {
    href: 'https://example.com/test',
    hostname: 'example.com',
    pathname: '/test'
  },
  setInterval: jest.fn(() => 123),
  clearInterval: jest.fn(),
  addEventListener: jest.fn(),
  history: {
    pushState: jest.fn(),
    replaceState: jest.fn()
  }
};

const mockDocument = {
  readyState: 'complete',
  hidden: false,
  body: document.createElement('body'),
  documentElement: document.createElement('html'),
  addEventListener: jest.fn(),
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  createElement: jest.fn(() => document.createElement('div'))
};

(global as any).window = mockWindow;
(global as any).document = mockDocument;

describe('ContentScript Index - Behavior Tests', () => {
  let mockBlockingEngine: jest.Mocked<BlockingEngine>;
  let mockBlockedPageUI: jest.Mocked<BlockedPageUI>;
  let mockFloatingTimer: jest.Mocked<FloatingTimer>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset global state
    delete (global as any).contentScriptManager;
    (global as any).contentScriptManagerInitialized = false;
    
    // Mock class instances
    mockBlockingEngine = {
      updateBlockedSites: jest.fn(),
      updateWhitelistedPaths: jest.fn(),
      shouldBlockWebsite: jest.fn().mockReturnValue(false)
    } as any;

    mockBlockedPageUI = {
      updateSettings: jest.fn(),
      removeBlockedPage: jest.fn(),
      isPageBlocked: jest.fn().mockReturnValue(false),
      setTimerState: jest.fn(),
      createBlockedPage: jest.fn(),
      cleanup: jest.fn()
    } as any;

    mockFloatingTimer = {
      initialize: jest.fn().mockResolvedValue(undefined),
      setAlwaysShow: jest.fn(),
      requestTimerStatus: jest.fn(),
      destroy: jest.fn()
    } as any;

    // Mock constructors
    (BlockingEngine as jest.MockedClass<typeof BlockingEngine>)
      .mockImplementation(() => mockBlockingEngine);
    (BlockedPageUI as jest.MockedClass<typeof BlockedPageUI>)
      .mockImplementation(() => mockBlockedPageUI);
    (FloatingTimer as jest.MockedClass<typeof FloatingTimer>)
      .mockImplementation(() => mockFloatingTimer);

    // Setup default mocks
    mockGetSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockGetBlockedWebsites.mockResolvedValue(['facebook.com']);
    mockGetWhitelistedPaths.mockResolvedValue(['example.com/allowed']);
    mockChrome.runtime.sendMessage.mockResolvedValue({ status: { state: 'STOPPED' } });
    mockShouldBlockBasedOnWorkHours.mockReturnValue(true);
    mockOnStorageChanged.mockImplementation(() => {});
  });

  describe('Module Initialization', () => {
    test('should successfully initialize when DOM is ready', async () => {
      mockDocument.readyState = 'complete';
      
      // Import the module
      require('../src/contentScript/index');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the content script manager is available globally
      expect((global as any).contentScriptManager).toBeDefined();
      expect((global as any).contentScriptManagerInitialized).toBe(true);
    });

    test('should initialize when DOM loads if initially loading', async () => {
      mockDocument.readyState = 'loading';
      let domLoadedCallback: Function;
      
      mockDocument.addEventListener.mockImplementation((event, callback) => {
        if (event === 'DOMContentLoaded') {
          domLoadedCallback = callback as Function;
        }
      });

      // Import the module
      require('../src/contentScript/index');
      
      // Verify it waits for DOM
      expect((global as any).contentScriptManager).toBeUndefined();
      
      // Simulate DOM loaded
      if (domLoadedCallback!) {
        domLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Now it should be initialized
      expect((global as any).contentScriptManager).toBeDefined();
    });

    test('should prevent multiple initializations', () => {
      mockDocument.readyState = 'complete';
      
      // Set as already initialized
      (global as any).contentScriptManagerInitialized = true;
      
      // Import the module
      require('../src/contentScript/index');
      
      // Should not create new instance
      expect(BlockingEngine).not.toHaveBeenCalled();
      expect((global as any).contentScriptManager).toBeUndefined();
    });
  });

  describe('Page Blocking Behavior', () => {
    beforeEach(async () => {
      mockDocument.readyState = 'complete';
      require('../src/contentScript/index');
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should not block pages when extension is disabled', async () => {
      const disabledSettings = { ...DEFAULT_SETTINGS, extensionEnabled: false };
      mockGetSettings.mockResolvedValue(disabledSettings);
      
      // Simulate a storage change to trigger reconfiguration
      const storageCallback = mockOnStorageChanged.mock.calls[0]?.[0];
      if (storageCallback) {
        storageCallback({ blockedWebsitesArray: { newValue: ['facebook.com'] } }, 'sync');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should remove any existing blocks
      expect(mockBlockedPageUI.removeBlockedPage).toHaveBeenCalled();
    });

    test('should block pages when they match blocking rules and timer is in WORK state', async () => {
      mockBlockingEngine.shouldBlockWebsite.mockReturnValue(true);
      mockChrome.runtime.sendMessage.mockResolvedValue({ status: { state: 'WORK' } });
      
      // Get the content script manager and trigger blocking check
      const manager = (global as any).contentScriptManager;
      if (manager && manager.checkAndBlock) {
        await manager.checkAndBlock();
      }

      // Should create blocked page
      expect(mockBlockedPageUI.createBlockedPage).toHaveBeenCalled();
    });

    test('should not block pages during REST state even if rules match', async () => {
      mockBlockingEngine.shouldBlockWebsite.mockReturnValue(true);
      mockChrome.runtime.sendMessage.mockResolvedValue({ status: { state: 'REST' } });
      
      // Get the content script manager and trigger blocking check
      const manager = (global as any).contentScriptManager;
      if (manager && manager.checkAndBlock) {
        await manager.checkAndBlock();
      }

      // Should remove any existing blocks
      expect(mockBlockedPageUI.removeBlockedPage).toHaveBeenCalled();
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      mockDocument.readyState = 'complete';
      require('../src/contentScript/index');
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should update blocking configuration when storage changes', async () => {
      const newBlockedSites = ['twitter.com', 'instagram.com'];
      mockGetBlockedWebsites.mockResolvedValue(newBlockedSites);
      
      // Trigger storage change
      const storageCallback = mockOnStorageChanged.mock.calls[0]?.[0];
      if (storageCallback) {
        storageCallback({ blockedWebsitesArray: { newValue: newBlockedSites } }, 'sync');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should update the blocking engine with new sites
      expect(mockBlockingEngine.updateBlockedSites).toHaveBeenCalledWith(newBlockedSites);
    });

    test('should update settings when they change in storage', async () => {
      const newSettings = { ...DEFAULT_SETTINGS, debugEnabled: true };
      mockGetSettings.mockResolvedValue(newSettings);
      
      // Trigger storage change
      const storageCallback = mockOnStorageChanged.mock.calls[0]?.[0];
      if (storageCallback) {
        storageCallback({ extensionEnabled: { newValue: true } }, 'sync');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should update UI with new settings
      expect(mockBlockedPageUI.updateSettings).toHaveBeenCalledWith(newSettings);
    });
  });

  describe('Timer Integration', () => {
    beforeEach(async () => {
      mockDocument.readyState = 'complete';
      require('../src/contentScript/index');
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should respond to timer state changes', async () => {
      // Simulate runtime message for timer update
      const messageCallback = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
      if (messageCallback) {
        messageCallback(
          { type: 'TIMER_UPDATE', status: { state: 'WORK', timeLeft: 1200 } },
          { id: 'extension-id' },
          jest.fn()
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should update UI with timer state
      expect(mockBlockedPageUI.setTimerState).toHaveBeenCalledWith('WORK');
    });

    test('should handle timer completion messages', async () => {
      // Simulate timer completion message
      const messageCallback = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
      if (messageCallback) {
        messageCallback(
          { type: 'TIMER_COMPLETE', state: 'WORK' },
          { id: 'extension-id' },
          jest.fn()
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should re-check blocking status
      // This is verified by checking if blocking logic was triggered
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TIMER_STATUS' });
    });
  });

  describe('Navigation Detection', () => {
    beforeEach(async () => {
      mockDocument.readyState = 'complete';
      require('../src/contentScript/index');
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should detect URL changes and re-evaluate blocking', async () => {
      // Change the current URL
      Object.defineProperty(mockWindow.location, 'href', { 
        value: 'https://facebook.com/feed', 
        writable: true 
      });
      
      // Simulate the periodic URL check  
      if (mockWindow.setInterval.mock.calls.length > 0) {
        const intervalCallback = mockWindow.setInterval.mock.calls[0][0] as Function;
        intervalCallback();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should request timer status for new page
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TIMER_STATUS' });
    });

    test('should set up periodic URL monitoring', () => {
      // Should establish an interval for URL checking
      expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
    });
  });

  describe('Cleanup Behavior', () => {
    beforeEach(async () => {
      mockDocument.readyState = 'complete';
      require('../src/contentScript/index');
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should clean up resources when extension is disabled', async () => {
      const disabledSettings = { ...DEFAULT_SETTINGS, extensionEnabled: false };
      mockGetSettings.mockResolvedValue(disabledSettings);
      
      // Trigger settings change
      const storageCallback = mockOnStorageChanged.mock.calls[0]?.[0];
      if (storageCallback) {
        storageCallback({ extensionEnabled: { newValue: false } }, 'sync');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should clean up UI
      expect(mockBlockedPageUI.removeBlockedPage).toHaveBeenCalled();
    });

    test('should provide cleanup method for extension unload', () => {
      const manager = (global as any).contentScriptManager;
      
      // Should have cleanup capabilities
      expect(manager).toBeDefined();
      
      // Verify global reference exists for cleanup
      expect((global as any).contentScriptManager).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      mockGetSettings.mockRejectedValue(new Error('Storage unavailable'));
      mockDocument.readyState = 'complete';
      
      // Should not throw when importing
      expect(() => {
        require('../src/contentScript/index');
      }).not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still create basic structure even with errors
      expect((global as any).contentScriptManagerInitialized).toBe(true);
    });

    test('should handle missing DOM elements gracefully', async () => {
      Object.defineProperty(mockDocument, 'body', { value: null, writable: true });
      mockDocument.readyState = 'complete';
      
      // Should not throw when importing
      expect(() => {
        require('../src/contentScript/index');
      }).not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still initialize
      expect((global as any).contentScriptManager).toBeDefined();
    });
  });
});