import { PomodoroSettingsManager } from '@options/PomodoroSettingsManager';
import { PomodoroSettings } from '@shared/pomodoroTypes';
import { StatusMessage } from '@shared/types';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    sendMessage: jest.fn()
  }
};

(global as any).chrome = mockChrome;

// Mock DOM
const createMockDOM = () => {
  document.body.innerHTML = `
    <div class="container">
      <div class="settings-section">Existing section</div>
    </div>
  `;
};

describe('PomodoroSettingsManager', () => {
  let manager: PomodoroSettingsManager;
  let onStatusMessage: jest.Mock;

  const defaultSettings: PomodoroSettings = {
    workDuration: 25,
    restDuration: 5,
    longRestDuration: 15,
    longRestInterval: 4,
    autoStartRest: true,
    autoStartWork: true,
    showNotifications: true,
    playSound: true,
    audioEnabled: true,
    audioVolume: 0.5,
    soundTheme: 'default' as const,
    workCompleteSound: 'ding.mp3',
    restCompleteSound: 'ding.mp3',
    sessionStartSound: 'ding.mp3',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createMockDOM();
    onStatusMessage = jest.fn();
    manager = new PomodoroSettingsManager(onStatusMessage);

    // Setup default Chrome API responses
    mockChrome.runtime.sendMessage.mockResolvedValue({ settings: defaultSettings });
    mockChrome.storage.local.get.mockResolvedValue({ floatingTimerSettings: { alwaysShow: true } });
    mockChrome.storage.local.set.mockResolvedValue(undefined);
  });

  describe('Constructor', () => {
    test('should create manager with status message callback', () => {
      expect(manager).toBeInstanceOf(PomodoroSettingsManager);
    });

    test('should create manager without status message callback', () => {
      const managerWithoutCallback = new PomodoroSettingsManager();
      expect(managerWithoutCallback).toBeInstanceOf(PomodoroSettingsManager);
    });
  });

  describe('UI Initialization', () => {
    test('should create pomodoro settings HTML', () => {
      manager.initializeUI();
      
      const pomodoroSection = document.querySelector('.settings-section');
      expect(pomodoroSection).toBeTruthy();
      expect(pomodoroSection?.innerHTML).toContain('🍅 Pomodoro Timer');
      expect(pomodoroSection?.innerHTML).toContain('Timer Durations');
      expect(pomodoroSection?.innerHTML).toContain('Timer Behavior');
    });

    test('should initialize DOM elements', () => {
      manager.initializeUI();
      
      // Check that key input elements exist
      expect(document.getElementById('workDurationMinutes')).toBeTruthy();
      expect(document.getElementById('workDurationSeconds')).toBeTruthy();
      expect(document.getElementById('restDurationMinutes')).toBeTruthy();
      expect(document.getElementById('autoStartRest')).toBeTruthy();
      expect(document.getElementById('showNotifications')).toBeTruthy();
    });

    test('should load settings after initialization', async () => {
      manager.initializeUI();
      
      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_POMODORO_SETTINGS' });
      expect(mockChrome.storage.local.get).toHaveBeenCalled();
    });
  });

  describe('Settings Display', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should display settings correctly', async () => {
      const customSettings: PomodoroSettings = {
        workDuration: 30,
        restDuration: 7.5, // 7 minutes 30 seconds
        longRestDuration: 20,
        longRestInterval: 3,
        autoStartRest: false,
        autoStartWork: false,
        showNotifications: false,
        playSound: false,
        audioEnabled: false,
        audioVolume: 0.5,
        soundTheme: 'default' as const,
        workCompleteSound: 'ding.mp3',
        restCompleteSound: 'ding.mp3',
        sessionStartSound: 'ding.mp3',
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({ settings: customSettings });
      
      // Load settings
      await manager['loadAndDisplaySettings']();
      
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      const restMinutes = document.getElementById('restDurationMinutes') as HTMLInputElement;
      const restSeconds = document.getElementById('restDurationSeconds') as HTMLInputElement;
      const autoStartRest = document.getElementById('autoStartRest') as HTMLInputElement;
      
      expect(workMinutes.value).toBe('30');
      expect(restMinutes.value).toBe('7');
      expect(restSeconds.value).toBe('30');
      expect(autoStartRest.checked).toBe(false);
    });

    test('should handle settings loading error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Failed to load'));
      
      await manager['loadAndDisplaySettings']();
      
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error loading pomodoro settings',
        type: 'error'
      });
    });
  });

  describe('Settings Retrieval', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should get current settings from UI', () => {
      // Set some test values
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      const workSeconds = document.getElementById('workDurationSeconds') as HTMLInputElement;
      const restMinutes = document.getElementById('restDurationMinutes') as HTMLInputElement;
      const autoStartRest = document.getElementById('autoStartRest') as HTMLInputElement;
      
      workMinutes.value = '45';
      workSeconds.value = '30';
      restMinutes.value = '10';
      autoStartRest.checked = false;
      
      const settings = manager.getCurrentSettings();
      
      expect(settings.workDuration).toBe(45.5); // 45 minutes + 30 seconds
      expect(settings.restDuration).toBe(10);
      expect(settings.autoStartRest).toBe(false);
    });

    test('should handle invalid input values', () => {
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      const workSeconds = document.getElementById('workDurationSeconds') as HTMLInputElement;
      
      workMinutes.value = 'invalid';
      workSeconds.value = '';
      
      const settings = manager.getCurrentSettings();
      
      expect(settings.workDuration).toBe(0); // Should default to 0 for invalid input
    });
  });

  describe('Settings Saving', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should save valid settings successfully', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
      
      // Set valid values
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      workMinutes.value = '25';
      
      const result = await manager.saveSettings();
      
      expect(result).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_POMODORO_SETTINGS',
        settings: expect.any(Object)
      });
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Pomodoro settings saved successfully!',
        type: 'success'
      });
    });

    test('should validate settings before saving', async () => {
      // Set invalid work duration (too long)
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      workMinutes.value = '150'; // 150 minutes > 120 minute limit
      
      const result = await manager.saveSettings();
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Work duration must be between 1 second and 120 minutes',
        type: 'error'
      });
      // Allow the initial GET_POMODORO_SETTINGS call from initialization
      const updateCalls = mockChrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'UPDATE_POMODORO_SETTINGS'
      );
      expect(updateCalls).toHaveLength(0);
    });

    test('should handle save errors', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Save failed'));
      
      const result = await manager.saveSettings();
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error saving pomodoro settings',
        type: 'error'
      });
    });
  });

  describe('Settings Validation', () => {
    test('should validate work duration limits', () => {
      const validSettings = { ...defaultSettings, workDuration: 25 };
      expect(manager['validateSettings'](validSettings)).toBeNull();
      
      const tooShort = { ...defaultSettings, workDuration: 0 };
      expect(manager['validateSettings'](tooShort)).toContain('Work duration must be between');
      
      const tooLong = { ...defaultSettings, workDuration: 121 };
      expect(manager['validateSettings'](tooLong)).toContain('Work duration must be between');
    });

    test('should validate rest duration limits', () => {
      const tooShort = { ...defaultSettings, restDuration: 0 };
      expect(manager['validateSettings'](tooShort)).toContain('Rest duration must be between');
      
      const tooLong = { ...defaultSettings, restDuration: 61 };
      expect(manager['validateSettings'](tooLong)).toContain('Rest duration must be between');
    });

    test('should validate long rest interval limits', () => {
      const tooSmall = { ...defaultSettings, longRestInterval: 1 };
      expect(manager['validateSettings'](tooSmall)).toContain('Long rest interval must be between');
      
      const tooLarge = { ...defaultSettings, longRestInterval: 11 };
      expect(manager['validateSettings'](tooLarge)).toContain('Long rest interval must be between');
    });
  });

  describe('Preset Buttons', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should apply preset values when clicked', () => {
      const presetButton = document.querySelector('[data-work="45"]') as HTMLButtonElement;
      expect(presetButton).toBeTruthy();
      
      presetButton.click();
      
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      const restMinutes = document.getElementById('restDurationMinutes') as HTMLInputElement;
      const longRestMinutes = document.getElementById('longRestDurationMinutes') as HTMLInputElement;
      const interval = document.getElementById('longRestInterval') as HTMLInputElement;
      
      expect(workMinutes.value).toBe('45');
      expect(restMinutes.value).toBe('15');
      expect(longRestMinutes.value).toBe('30');
      expect(interval.value).toBe('3');
      
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Preset applied! Remember to save settings.',
        type: 'success'
      });
    });

    test('should highlight active preset', () => {
      // Set values that match a preset
      const workMinutes = document.getElementById('workDurationMinutes') as HTMLInputElement;
      const restMinutes = document.getElementById('restDurationMinutes') as HTMLInputElement;
      const longRestMinutes = document.getElementById('longRestDurationMinutes') as HTMLInputElement;
      const interval = document.getElementById('longRestInterval') as HTMLInputElement;
      
      workMinutes.value = '25';
      restMinutes.value = '5';
      longRestMinutes.value = '15';
      interval.value = '4';
      
      // Trigger update
      workMinutes.dispatchEvent(new Event('input'));
      
      const classicPreset = document.querySelector('[data-work="25"]');
      expect(classicPreset?.classList.contains('active')).toBe(true);
    });
  });

  describe('Floating Timer Settings', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should update floating timer setting immediately', async () => {
      const floatingTimerToggle = document.getElementById('showFloatingTimer') as HTMLInputElement;
      
      floatingTimerToggle.checked = false;
      floatingTimerToggle.dispatchEvent(new Event('change'));
      
      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        floatingTimerSettings: expect.objectContaining({
          alwaysShow: false
        })
      });
      
      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Floating timer disabled!',
        type: 'success'
      });
    });

    test('should handle floating timer setting errors', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));
      
      const floatingTimerToggle = document.getElementById('showFloatingTimer') as HTMLInputElement;
      floatingTimerToggle.checked = true;
      floatingTimerToggle.dispatchEvent(new Event('change'));
      
      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error updating floating timer setting',
        type: 'error'
      });
    });
  });

  describe('Toggle Labels', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should update toggle labels based on state', () => {
      const autoStartRest = document.getElementById('autoStartRest') as HTMLInputElement;
      const autoStartRestLabel = document.getElementById('autoStartRestLabel') as HTMLElement;
      
      autoStartRest.checked = true;
      autoStartRest.dispatchEvent(new Event('change'));
      
      expect(autoStartRestLabel.textContent).toBe('Auto-start breaks enabled');
      
      autoStartRest.checked = false;
      autoStartRest.dispatchEvent(new Event('change'));
      
      expect(autoStartRestLabel.textContent).toBe('Auto-start breaks disabled');
    });

    test('should update floating timer label', () => {
      const floatingTimerToggle = document.getElementById('showFloatingTimer') as HTMLInputElement;
      const floatingTimerLabel = document.getElementById('floatingTimerLabel') as HTMLElement;
      
      floatingTimerToggle.checked = true;
      manager['updateToggleLabels']();
      
      expect(floatingTimerLabel.textContent).toBe('Always show floating timer');
      
      floatingTimerToggle.checked = false;
      manager['updateToggleLabels']();
      
      expect(floatingTimerLabel.textContent).toBe('Show floating timer when active');
    });
  });

  describe('Audio Test Functionality', () => {
    beforeEach(() => {
      manager.initializeUI();
    });

    test('should send TEST_SOUND message when test button clicked', async () => {
      // Get test sound button
      const testButton = document.querySelector('[data-sound="workComplete"]') as HTMLButtonElement;
      expect(testButton).toBeTruthy();
      
      // Click the test button
      testButton.click();
      
      // Wait for the async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have sent TEST_SOUND message (note: sound IDs don't include .mp3 extension)
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TEST_SOUND',
        data: {
          soundId: 'chime', // Default value from select option
          volume: expect.any(Number)
        }
      });
    });

    test('should handle test sound errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Test failed'));
      
      const testButton = document.querySelector('[data-sound="restComplete"]') as HTMLButtonElement;
      testButton.click();
      
      // Wait for the async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have attempted to send message
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TEST_SOUND',
        data: {
          soundId: 'bell', // Default value from select option
          volume: expect.any(Number)
        }
      });
    });

    test('should test different sound types correctly', async () => {
      const testButtons = [
        { selector: '[data-sound="workComplete"]', expectedSoundId: 'chime' },  // Default select values
        { selector: '[data-sound="restComplete"]', expectedSoundId: 'bell' },
        { selector: '[data-sound="sessionStart"]', expectedSoundId: 'ding' }
      ];

      for (const { selector, expectedSoundId } of testButtons) {
        jest.clearAllMocks();
        
        const testButton = document.querySelector(selector) as HTMLButtonElement;
        expect(testButton).toBeTruthy();
        
        testButton.click();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'TEST_SOUND',
          data: {
            soundId: expectedSoundId,
            volume: expect.any(Number)
          }
        });
      }
    });
  });
});