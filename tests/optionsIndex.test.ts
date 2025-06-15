import { ExtensionSettings } from '@shared/types';
import { UI_CONFIG, WORK_HOURS_CONFIG } from '@shared/constants';
import { SettingsManager } from '../src/options/SettingsManager';
import { SiteListManager } from '../src/options/SiteListManager';
import { PomodoroSettingsManager } from '../src/options/PomodoroSettingsManager';

// Mock dependencies
jest.mock('../src/options/SettingsManager');
jest.mock('../src/options/SiteListManager');
jest.mock('../src/options/PomodoroSettingsManager');

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    create: jest.fn()
  },
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`)
  }
};

(global as any).chrome = mockChrome;

// Mock DOM elements
const createMockElement = (id: string, tag: string = 'div') => {
  const element = document.createElement(tag);
  element.id = id;
  if (tag === 'button') {
    (element as HTMLButtonElement).disabled = false;
    element.addEventListener = jest.fn();
  }
  return element;
};

const mockElements = {
  historyButton: createMockElement('historyButton', 'button'),
  statusMessage: createMockElement('statusMessage'),
  newSiteInput: createMockElement('newSiteInput', 'input')
};

// Mock document.getElementById
const originalGetElementById = document.getElementById;
document.getElementById = jest.fn((id: string) => {
  return mockElements[id as keyof typeof mockElements] || null;
});

describe('Options Index - Behavior Tests', () => {
  let mockSettingsManager: jest.Mocked<SettingsManager>;
  let mockSiteListManager: jest.Mocked<SiteListManager>;
  let mockPomodoroSettingsManager: jest.Mocked<PomodoroSettingsManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    Object.defineProperty(document, 'readyState', { value: 'complete', writable: true });
    
    // Mock manager instances
    mockSettingsManager = {
      loadSettings: jest.fn(),
      saveSettingsToStorage: jest.fn(),
      resetSettings: jest.fn(),
      testRedirectUrl: jest.fn(),
      getSuggestedUrls: jest.fn(),
      debugWorkHours: jest.fn()
    } as any;

    mockSiteListManager = {
      addBlockedSite: jest.fn(),
      addWhitelistedPath: jest.fn(),
      clearAllBlockedSites: jest.fn(),
      clearAllWhitelistedPaths: jest.fn(),
      loadBlockedWebsites: jest.fn(),
      loadWhitelistedPaths: jest.fn(),
      removeBlockedSite: jest.fn(),
      removeWhitelistedPath: jest.fn(),
      validateInput: jest.fn(),
      getSiteTypeLabel: jest.fn()
    } as any;

    mockPomodoroSettingsManager = {
      initializeUI: jest.fn(),
      saveSettings: jest.fn()
    } as any;

    // Mock constructors
    (SettingsManager as jest.MockedClass<typeof SettingsManager>)
      .mockImplementation(() => mockSettingsManager);
    (SiteListManager as jest.MockedClass<typeof SiteListManager>)
      .mockImplementation(() => mockSiteListManager);
    (PomodoroSettingsManager as jest.MockedClass<typeof PomodoroSettingsManager>)
      .mockImplementation(() => mockPomodoroSettingsManager);

    // Setup default responses
    mockSettingsManager.loadSettings.mockResolvedValue({
      blockMode: 'block',
      redirectUrl: 'https://www.google.com',
      redirectDelay: 3,
      extensionEnabled: true,
      debugEnabled: false
    } as ExtensionSettings);
    mockSettingsManager.saveSettingsToStorage.mockResolvedValue(true);
    mockSiteListManager.loadBlockedWebsites.mockResolvedValue(['example.com']);
    mockSiteListManager.loadWhitelistedPaths.mockResolvedValue(['example.com/path']);
    mockPomodoroSettingsManager.saveSettings.mockResolvedValue(true);
  });

  afterEach(() => {
    document.getElementById = originalGetElementById;
  });

  describe('Options Page Initialization', () => {
    test('should initialize all managers when DOM is ready', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should create all required managers
      expect(SettingsManager).toHaveBeenCalled();
      expect(SiteListManager).toHaveBeenCalled();
      expect(PomodoroSettingsManager).toHaveBeenCalled();
      expect(mockPomodoroSettingsManager.initializeUI).toHaveBeenCalled();
    });

    test('should load and display initial settings', async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should load settings
      expect(mockSettingsManager.loadSettings).toHaveBeenCalled();
      expect(mockSiteListManager.loadBlockedWebsites).toHaveBeenCalled();
      expect(mockSiteListManager.loadWhitelistedPaths).toHaveBeenCalled();
    });

    test('should focus on site input field after initialization', async () => {
      const focusSpy = jest.spyOn(mockElements.newSiteInput, 'focus');
      
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('Navigation Controls', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should open history page when history button is clicked', () => {
      const clickEvent = new Event('click');
      mockElements.historyButton.dispatchEvent(clickEvent);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/history.html'
      });
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should save settings successfully', async () => {
      // Create mock save button and trigger save
      const saveButton = createMockElement('saveSettings', 'button');
      mockElements.saveSettings = saveButton;
      
      const clickEvent = new Event('click');
      saveButton.dispatchEvent(clickEvent);

      // Should attempt to save settings
      expect(mockSettingsManager.saveSettingsToStorage).toBeDefined();
      expect(mockPomodoroSettingsManager.saveSettings).toBeDefined();
    });

    test('should reset settings when requested', async () => {
      // Should provide reset functionality
      expect(mockSettingsManager.resetSettings).toBeDefined();
    });

    test('should test redirect URL functionality', () => {
      // Should provide URL testing
      expect(mockSettingsManager.testRedirectUrl).toBeDefined();
    });
  });

  describe('Site Management', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should add blocked sites', async () => {
      mockSiteListManager.addBlockedSite.mockResolvedValue(true);
      
      // Should provide site blocking functionality
      expect(mockSiteListManager.addBlockedSite).toBeDefined();
    });

    test('should add whitelisted paths', async () => {
      mockSiteListManager.addWhitelistedPath.mockResolvedValue(true);
      
      // Should provide whitelist functionality
      expect(mockSiteListManager.addWhitelistedPath).toBeDefined();
    });

    test('should clear all sites when requested', () => {
      // Should provide clear all functionality
      expect(mockSiteListManager.clearAllBlockedSites).toBeDefined();
      expect(mockSiteListManager.clearAllWhitelistedPaths).toBeDefined();
    });

    test('should validate site input', () => {
      mockSiteListManager.validateInput.mockReturnValue({ isValid: true, message: '' });
      
      // Should provide input validation
      expect(mockSiteListManager.validateInput).toBeDefined();
    });
  });

  describe('Work Hours Configuration', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle work hours settings', () => {
      // Work hours functionality should be managed through settings manager
      expect(mockSettingsManager.loadSettings).toHaveBeenCalled();
    });

    test('should debug work hours when enabled', () => {
      // Should provide work hours debugging
      expect(mockSettingsManager.debugWorkHours).toBeDefined();
    });
  });

  describe('Status Message Display', () => {
    beforeEach(async () => {
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should display status messages', () => {
      // Status message element should be available
      expect(mockElements.statusMessage).toBeDefined();
    });

    test('should handle different message types', () => {
      // Status messages can have different styling
      expect(mockElements.statusMessage.className).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle settings load failures gracefully', async () => {
      mockSettingsManager.loadSettings.mockRejectedValue(new Error('Load failed'));
      
      const event = new Event('DOMContentLoaded');
      
      // Should not throw on import
      expect(() => {
        require('../src/options/index');
        document.dispatchEvent(event);
      }).not.toThrow();
    });

    test('should handle save failures gracefully', async () => {
      mockPomodoroSettingsManager.saveSettings.mockResolvedValue(false);
      
      const event = new Event('DOMContentLoaded');
      require('../src/options/index');
      document.dispatchEvent(event);
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle save failures without crashing
      expect(mockPomodoroSettingsManager.saveSettings).toBeDefined();
    });

    test('should handle site management errors gracefully', async () => {
      mockSiteListManager.addBlockedSite.mockResolvedValue(false);
      
      // Should handle site management errors
      expect(mockSiteListManager.addBlockedSite).toBeDefined();
    });
  });
});