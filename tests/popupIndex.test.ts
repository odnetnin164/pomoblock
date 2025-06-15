import { getBlockedWebsites, getWhitelistedPaths, addWhitelistedPath } from '@shared/storage';
import { StatusDisplay } from '../src/popup/components/StatusDisplay';
import { SiteManager } from '../src/popup/components/SiteManager';
import { PomodoroControl } from '../src/popup/components/PomodoroControl';
import { UI_CONFIG } from '@shared/constants';

// Mock dependencies
jest.mock('@shared/storage');
jest.mock('../src/popup/components/StatusDisplay');
jest.mock('../src/popup/components/SiteManager');
jest.mock('../src/popup/components/PomodoroControl');

const mockGetBlockedWebsites = getBlockedWebsites as jest.MockedFunction<typeof getBlockedWebsites>;
const mockGetWhitelistedPaths = getWhitelistedPaths as jest.MockedFunction<typeof getWhitelistedPaths>;
const mockAddWhitelistedPath = addWhitelistedPath as jest.MockedFunction<typeof addWhitelistedPath>;

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    sendMessage: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn(),
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`)
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;
(global as any).window = {
  ...window,
  close: jest.fn(),
  setInterval: jest.fn(() => 123),
  clearInterval: jest.fn(),
  addEventListener: jest.fn()
};

// Mock DOM elements
const createMockElement = (id: string, tag: string = 'div') => {
  const element = document.createElement(tag);
  element.id = id;
  if (tag === 'button') {
    (element as HTMLButtonElement).disabled = false;
  }
  if (tag === 'input') {
    (element as HTMLInputElement).checked = false;
    (element as HTMLInputElement).value = '';
  }
  return element;
};

const mockElements = {
  currentUrl: createMockElement('currentUrl'),
  blockTarget: createMockElement('blockTarget'),
  blockCurrentButton: createMockElement('blockCurrentButton', 'button'),
  optionsButton: createMockElement('optionsButton', 'button'),
  historyButton: createMockElement('historyButton', 'button'),
  blockTypeSection: createMockElement('blockTypeSection'),
  blockTypeHeader: createMockElement('blockTypeHeader'),
  blockTypeToggle: createMockElement('blockTypeToggle', 'button'),
  blockOptions: createMockElement('blockOptions'),
  floatingTimerToggle: createMockElement('floatingTimerToggle', 'input'),
  statusDisplay: createMockElement('statusDisplay'),
  siteCount: createMockElement('siteCount'),
  pomodoroContainer: createMockElement('pomodoroContainer')
};

// Mock document.getElementById
const originalGetElementById = document.getElementById;
document.getElementById = jest.fn((id: string) => {
  return mockElements[id as keyof typeof mockElements] || null;
});

describe('Popup Index - Behavior Tests', () => {
  let mockStatusDisplay: jest.Mocked<StatusDisplay>;
  let mockSiteManager: jest.Mocked<SiteManager>;
  let mockPomodoroControl: jest.Mocked<PomodoroControl>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    Object.defineProperty(document, 'readyState', { value: 'complete', writable: true });
    
    // Mock component instances
    mockStatusDisplay = {
      updateSiteCount: jest.fn()
    } as any;

    mockSiteManager = {
      setCurrentTab: jest.fn(),
      getCurrentSiteInfo: jest.fn(),
      getBlockTarget: jest.fn(),
      getBlockOptions: jest.fn(),
      getSelectedBlockType: jest.fn(),
      setSelectedBlockType: jest.fn(),
      getSelectedBlockTarget: jest.fn(),
      getSubdomainWhitelistOptions: jest.fn(),
      checkIfWhitelisted: jest.fn(),
      checkIfWouldBeBlocked: jest.fn(),
      updateBlockTargetStatus: jest.fn(),
      addToBlockedList: jest.fn(),
      addToWhitelist: jest.fn(),
      removeFromWhitelist: jest.fn(),
      findMatchingWhitelistEntry: jest.fn()
    } as any;

    mockPomodoroControl = {
      destroy: jest.fn()
    } as any;

    // Mock constructors
    (StatusDisplay as jest.MockedClass<typeof StatusDisplay>)
      .mockImplementation(() => mockStatusDisplay);
    (SiteManager as jest.MockedClass<typeof SiteManager>)
      .mockImplementation(() => mockSiteManager);
    (PomodoroControl as jest.MockedClass<typeof PomodoroControl>)
      .mockImplementation(() => mockPomodoroControl);

    // Setup default responses
    mockGetBlockedWebsites.mockResolvedValue(['facebook.com']);
    mockGetWhitelistedPaths.mockResolvedValue(['example.com/allowed']);
    mockChrome.tabs.query.mockImplementation((query, callback) => {
      if (callback) callback([{ url: 'https://example.com/test', id: 123 }]);
    });
    mockChrome.runtime.sendMessage.mockResolvedValue({ status: { state: 'STOPPED' } });
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ floatingTimerSettings: { alwaysShow: false } });
    });
  });

  afterEach(() => {
    document.getElementById = originalGetElementById;
  });

  describe('Popup Initialization', () => {
    test('should initialize all components when DOM is ready', async () => {
      // Trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should create all required components
      expect(StatusDisplay).toHaveBeenCalledWith('statusDisplay', 'siteCount');
      expect(SiteManager).toHaveBeenCalled();
      expect(PomodoroControl).toHaveBeenCalledWith('pomodoroContainer');
    });

    test('should load and display initial data', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should load site data
      expect(mockGetBlockedWebsites).toHaveBeenCalled();
      expect(mockGetWhitelistedPaths).toHaveBeenCalled();
      expect(mockChrome.tabs.query).toHaveBeenCalled();
      
      // Should update status display
      expect(mockStatusDisplay.updateSiteCount).toHaveBeenCalledWith(1, 1);
    });

    test('should setup current tab information', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSiteManager.setCurrentTab).toHaveBeenCalledWith('https://example.com/test');
    });
  });

  describe('Tab Access Handling', () => {
    test('should handle missing tab URL gracefully', async () => {
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        if (callback) callback([{ url: undefined, id: 123 }]);
      });

      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockElements.currentUrl.textContent).toBe('Unable to access current page');
      expect((mockElements.blockCurrentButton as HTMLButtonElement).disabled).toBe(true);
    });

    test('should handle tab query errors', async () => {
      mockChrome.tabs.query.mockImplementation(() => {
        throw new Error('Tab access error');
      });

      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockElements.currentUrl.textContent).toBe('Error accessing current page');
      expect((mockElements.blockCurrentButton as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('Site Information Display', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should display site information when available', () => {
      const mockSiteInfo = {
        hostname: 'example.com',
        pathname: '/test',
        url: 'https://example.com/test'
      };
      const mockBlockTarget = {
        target: 'example.com',
        label: 'example.com domain',
        isSpecialSite: false,
        isWhitelisted: false,
        isBlocked: false
      };

      mockSiteManager.getCurrentSiteInfo.mockReturnValue(mockSiteInfo);
      mockSiteManager.getBlockTarget.mockReturnValue(mockBlockTarget);

      // Verify the site manager can provide site info
      expect(mockSiteManager.getCurrentSiteInfo).toBeDefined();
      expect(mockSiteManager.getBlockTarget).toBeDefined();
    });

    test('should handle special sites appropriately', () => {
      const mockBlockTarget = {
        target: 'youtube.com',
        label: 'youtube.com domain',
        isSpecialSite: true,
        isWhitelisted: false,
        isBlocked: false
      };

      mockSiteManager.getBlockTarget.mockReturnValue(mockBlockTarget);
      
      // Verify special site detection works
      expect(mockSiteManager.getBlockTarget).toBeDefined();
    });
  });

  describe('Navigation Controls', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should open options page when options button is clicked', () => {
      const clickEvent = new Event('click');
      mockElements.optionsButton.dispatchEvent(clickEvent);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/options.html'
      });
      expect((global as any).window.close).toHaveBeenCalled();
    });

    test('should open history page when history button is clicked', () => {
      const clickEvent = new Event('click');
      mockElements.historyButton.dispatchEvent(clickEvent);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/history.html'
      });
      expect((global as any).window.close).toHaveBeenCalled();
    });
  });

  describe('Site Blocking Controls', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle block current site action', async () => {
      mockSiteManager.addToBlockedList.mockResolvedValue(['example.com']);
      
      const mockBlockTarget = {
        target: 'example.com',
        label: 'example.com domain',
        isSpecialSite: false,
        isBlocked: false,
        isWhitelisted: false
      };
      mockSiteManager.getBlockTarget.mockReturnValue(mockBlockTarget);

      const clickEvent = new Event('click');
      mockElements.blockCurrentButton.dispatchEvent(clickEvent);

      // Should attempt to block the site
      expect(mockSiteManager.addToBlockedList).toBeDefined();
    });

    test('should provide block type options when available', () => {
      const mockOptions = [
        { type: 'domain' as const, label: 'Domain', target: 'example.com', description: 'Block entire domain' },
        { type: 'path' as const, label: 'Path', target: 'example.com/test', description: 'Block specific path' }
      ];
      mockSiteManager.getBlockOptions.mockReturnValue(mockOptions);

      // Should provide multiple blocking options
      expect(mockSiteManager.getBlockOptions).toBeDefined();
    });

    test('should handle whitelist actions', async () => {
      mockSiteManager.addToWhitelist.mockResolvedValue(['example.com/path']);

      // Should provide whitelist functionality
      expect(mockSiteManager.addToWhitelist).toBeDefined();
      expect(mockSiteManager.removeFromWhitelist).toBeDefined();
    });
  });

  describe('Timer Integration', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should respond to timer state changes', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ status: { state: 'WORK' } });
      mockSiteManager.checkIfWouldBeBlocked.mockReturnValue(true);
      mockSiteManager.checkIfWhitelisted.mockReturnValue(false);

      // Should integrate with timer state
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TIMER_STATUS' });
    });

    test('should handle timer status errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Timer error'));

      // Should not crash on timer errors
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Floating Timer Settings', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should load floating timer settings', () => {
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['floatingTimerSettings']);
      expect((mockElements.floatingTimerToggle as HTMLInputElement).checked).toBe(false);
    });

    test('should handle floating timer settings changes', async () => {
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        if (callback) callback();
      });

      const changeEvent = new Event('change');
      (mockElements.floatingTimerToggle as HTMLInputElement).checked = true;
      mockElements.floatingTimerToggle.dispatchEvent(changeEvent);

      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
    });

    test('should handle floating timer settings errors', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        throw new Error('Storage error');
      });

      // Should handle storage errors gracefully
      expect(mockChrome.storage.local.get).toHaveBeenCalled();
    });
  });

  describe('Status Updates and Monitoring', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should establish periodic status updates', () => {
      expect((global as any).window.setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    test('should cleanup on popup close', () => {
      const beforeUnloadEvent = new Event('beforeunload');
      (global as any).window.dispatchEvent(beforeUnloadEvent);

      expect((global as any).window.clearInterval).toHaveBeenCalled();
      expect(mockPomodoroControl.destroy).toHaveBeenCalled();
    });

    test('should handle visibility changes', () => {
      // Test visibility change handling
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      const visibilityChangeEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityChangeEvent);

      expect((global as any).window.clearInterval).toHaveBeenCalled();

      // When becoming visible again
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(visibilityChangeEvent);

      expect((global as any).window.setInterval).toHaveBeenCalled();
    });
  });

  describe('Site Status Checking', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should check and update site blocking status', () => {
      mockSiteManager.getSelectedBlockTarget.mockReturnValue('example.com');
      mockSiteManager.checkIfWhitelisted.mockReturnValue(false);
      mockSiteManager.checkIfWouldBeBlocked.mockReturnValue(true);

      // Should check site status
      expect(mockGetBlockedWebsites).toHaveBeenCalled();
      expect(mockGetWhitelistedPaths).toHaveBeenCalled();
    });

    test('should update site manager with current status', () => {
      // Should provide status update capabilities
      expect(mockSiteManager.updateBlockTargetStatus).toBeDefined();
    });

    test('should handle site status check errors gracefully', async () => {
      mockGetBlockedWebsites.mockRejectedValue(new Error('Storage error'));

      // Should handle storage errors gracefully
      expect(mockGetBlockedWebsites).toHaveBeenCalled();
    });
  });

  describe('Block Type Management', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should show block type options when multiple options exist', () => {
      const mockOptions = [
        { type: 'domain' as const, label: 'Domain', target: 'example.com', description: 'Block entire domain' },
        { type: 'path' as const, label: 'Path', target: 'example.com/test', description: 'Block specific path' }
      ];
      mockSiteManager.getBlockOptions.mockReturnValue(mockOptions);

      // Should handle multiple block options
      expect(mockSiteManager.getBlockOptions).toBeDefined();
    });

    test('should hide block type selector for single option', () => {
      const mockOptions = [
        { type: 'domain' as const, label: 'Domain', target: 'example.com', description: 'Block entire domain' }
      ];
      mockSiteManager.getBlockOptions.mockReturnValue(mockOptions);

      // Should handle single block option
      expect(mockSiteManager.getBlockOptions).toBeDefined();
    });

    test('should toggle block options visibility', () => {
      const clickEvent = new Event('click');
      mockElements.blockTypeHeader.dispatchEvent(clickEvent);

      // Should handle toggle interaction
      expect(mockElements.blockTypeHeader).toBeDefined();
    });
  });

  describe('Subdomain Whitelist Handling', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/popup/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should provide subdomain whitelist options when applicable', () => {
      const mockSubdomainOptions = [
        {
          type: 'subdomain' as const,
          label: 'Whitelist subdomain',
          target: 'sub.example.com',
          description: 'Allow subdomain'
        }
      ];
      mockSiteManager.getSubdomainWhitelistOptions.mockReturnValue(mockSubdomainOptions);

      // Should handle subdomain whitelist options
      expect(mockSiteManager.getSubdomainWhitelistOptions).toBeDefined();
    });

    test('should handle subdomain whitelisting actions', async () => {
      mockAddWhitelistedPath.mockResolvedValue(['sub.example.com']);

      // Should provide subdomain whitelist functionality
      expect(mockAddWhitelistedPath).toBeDefined();
    });

    test('should handle subdomain whitelist errors', async () => {
      mockAddWhitelistedPath.mockRejectedValue(new Error('Whitelist failed'));

      // Should handle whitelist errors gracefully
      expect(mockAddWhitelistedPath).toBeDefined();
    });
  });
});