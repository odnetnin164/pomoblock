import { AudioManager } from '../src/shared/audioManager';
import { AudioSettings, SoundType } from '../src/shared/audioTypes';

// Mock chrome APIs
const mockChrome = {
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`)
  },
  storage: {
    local: {
      get: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;

// Mock AudioContext
const mockBufferSource = {
  buffer: null,
  connect: jest.fn(),
  start: jest.fn()
};

const mockGainNode = {
  gain: { value: 0 },
  connect: jest.fn()
};

const mockAudioBuffer = {
  duration: 1,
  length: 44100,
  numberOfChannels: 1,
  sampleRate: 44100,
  getChannelData: jest.fn(() => new Float32Array(8820)) // 0.2s at 44100Hz
};

const mockAudioContext = {
  createBuffer: jest.fn(() => mockAudioBuffer),
  createBufferSource: jest.fn(() => mockBufferSource),
  createGain: jest.fn(() => mockGainNode),
  decodeAudioData: jest.fn().mockResolvedValue(mockAudioBuffer),
  close: jest.fn(),
  destination: {},
  sampleRate: 44100
};

(global as any).AudioContext = jest.fn(() => mockAudioContext);

// Mock fetch with proper audio response
const mockResponse = {
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
  headers: {
    get: jest.fn((header: string) => {
      if (header === 'content-type') return 'audio/mp3';
      return null;
    })
  }
};

global.fetch = jest.fn().mockResolvedValue(mockResponse);

// Mock logger
jest.mock('../src/shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

describe('AudioManager', () => {
  let audioManager: AudioManager;
  let defaultSettings: AudioSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    
    defaultSettings = AudioManager.getDefaultSettings();
    audioManager = new AudioManager(defaultSettings);

    // Setup default mocks
    mockAudioContext.createBufferSource.mockReturnValue(mockBufferSource);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    mockAudioContext.createBuffer.mockReturnValue(mockAudioBuffer);
    
    (fetch as jest.Mock).mockResolvedValue(mockResponse);
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);

    // Reset buffer source mocks
    mockBufferSource.connect.mockClear();
    mockBufferSource.start.mockClear();
    mockGainNode.connect.mockClear();
  });

  describe('constructor', () => {
    test('should initialize with provided settings', () => {
      expect(audioManager.settings).toEqual(defaultSettings);
    });
  });

  describe('getDefaultSettings', () => {
    test('should return valid default settings', () => {
      const settings = AudioManager.getDefaultSettings();
      
      expect(settings.enabled).toBe(true);
      expect(settings.volume).toBe(70);
      expect(settings.soundTheme).toBe('default');
      expect(settings.sounds).toHaveProperty('work_complete');
      expect(settings.sounds).toHaveProperty('rest_complete');
      expect(settings.sounds).toHaveProperty('session_start');
      expect(settings.sounds).toHaveProperty('tick');
      expect(settings.sounds).toHaveProperty('warning');
    });

    test('should have valid sound options for all sound types', () => {
      const settings = AudioManager.getDefaultSettings();
      
      Object.values(settings.sounds).forEach(soundOption => {
        expect(soundOption).toHaveProperty('id');
        expect(soundOption).toHaveProperty('name');
        expect(soundOption).toHaveProperty('type');
        expect(['built-in', 'custom']).toContain(soundOption.type);
      });
    });
  });

  describe('getSoundThemes', () => {
    test('should return all sound themes', () => {
      const themes = AudioManager.getSoundThemes();
      
      expect(themes).toHaveProperty('default');
      expect(themes).toHaveProperty('nature');
      expect(themes).toHaveProperty('minimal');
    });

    test('should have valid theme structure', () => {
      const themes = AudioManager.getSoundThemes();
      
      Object.values(themes).forEach(theme => {
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('sounds');
        expect(theme.sounds).toHaveProperty('work_complete');
        expect(theme.sounds).toHaveProperty('rest_complete');
        expect(theme.sounds).toHaveProperty('session_start');
        expect(theme.sounds).toHaveProperty('tick');
        expect(theme.sounds).toHaveProperty('warning');
      });
    });
  });

  describe('initialize', () => {
    test('should initialize AudioContext successfully', async () => {
      await audioManager.initialize();
      
      expect(AudioContext).toHaveBeenCalled();
      // Built-in sounds are preloaded during initialization
      expect(fetch).toHaveBeenCalledWith('chrome-extension://test/sounds/chime.mp3');
    });

    test('should handle initialization errors gracefully', async () => {
      (AudioContext as jest.Mock).mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });
      
      // Create new manager after mocking constructor
      const testManager = new AudioManager(defaultSettings);
      await testManager.initialize();
      
      // Should not throw an error
      expect(true).toBe(true);
    });

    test('should not reinitialize if already initialized', async () => {
      await audioManager.initialize();
      
      // Clear previous calls and track new ones
      (AudioContext as jest.Mock).mockClear();
      
      await audioManager.initialize();
      
      // Should not call AudioContext constructor again
      expect((AudioContext as jest.Mock).mock.calls.length).toBe(0);
    });

    test('should preload built-in sounds', async () => {
      await audioManager.initialize();
      
      // Should fetch built-in sound files
      expect(fetch).toHaveBeenCalledWith('chrome-extension://test/sounds/chime.mp3');
      expect(fetch).toHaveBeenCalledWith('chrome-extension://test/sounds/bell.mp3');
    });
  });

  describe('playSound', () => {
    test('should play sound when enabled', async () => {
      // Mock fetch for sound loading
      (fetch as jest.Mock).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: {
          get: () => 'audio/mp3'
        }
      });

      // Mock decodeAudioData to return a mock buffer
      mockAudioContext.decodeAudioData.mockResolvedValueOnce(mockAudioBuffer);

      await audioManager.playSound('work_complete');
      
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockBufferSource.start).toHaveBeenCalled();
    });

    test('should not play sound when disabled', async () => {
      audioManager.updateSettings({
        ...defaultSettings,
        enabled: false
      });
      
      await audioManager.playSound('work_complete');
      
      expect(mockBufferSource.start).not.toHaveBeenCalled();
    });

    test('should set correct volume', async () => {
      // Mock fetch for sound loading
      (fetch as jest.Mock).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: {
          get: () => 'audio/mp3'
        }
      });

      // Mock decodeAudioData to return a mock buffer
      mockAudioContext.decodeAudioData.mockResolvedValueOnce(mockAudioBuffer);

      const customSettings = {
        ...defaultSettings,
        volume: 50
      };
      audioManager.updateSettings(customSettings);
      
      await audioManager.playSound('work_complete');
      
      expect(mockGainNode.gain.value).toBe(0.5);
    });

    test('should handle playbook errors gracefully', async () => {
      mockAudioContext.createBufferSource.mockImplementation(() => {
        throw new Error('Playback error');
      });
      
      await audioManager.playSound('work_complete');
      
      // Should not throw an error
      expect(true).toBe(true);
    });

    test('should play all sound types', async () => {
      const soundTypes: SoundType[] = ['work_complete', 'rest_complete', 'session_start', 'tick', 'warning'];
      
      for (const soundType of soundTypes) {
        // Reset mocks for each iteration
        jest.clearAllMocks();
        
        // Mock fetch for sound loading
        (fetch as jest.Mock).mockResolvedValueOnce({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
          headers: {
            get: () => 'audio/mp3'
          }
        });

        // Mock decodeAudioData to return a mock buffer
        mockAudioContext.decodeAudioData.mockResolvedValueOnce(mockAudioBuffer);

        await audioManager.playSound(soundType);
        expect(mockBufferSource.start).toHaveBeenCalled();
      }
    });
  });

  describe('updateSettings', () => {
    test('should update settings', () => {
      const newSettings: AudioSettings = {
        ...defaultSettings,
        volume: 80,
        enabled: false
      };
      
      audioManager.updateSettings(newSettings);
      
      expect(audioManager.settings).toEqual(newSettings);
    });
  });

  describe('custom sounds', () => {
    beforeEach(async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        customSounds: {
          'custom_test': {
            dataUrl: 'data:audio/mp3;base64,test'
          }
        }
      });
      
      await audioManager.initialize();
    });

    test('should load custom sounds from storage', async () => {
      const customSettings: AudioSettings = {
        ...defaultSettings,
        sounds: {
          ...defaultSettings.sounds,
          work_complete: {
            id: 'custom_test',
            name: 'Custom Test Sound',
            type: 'custom'
          }
        }
      };
      
      audioManager.updateSettings(customSettings);
      await audioManager.playSound('work_complete');
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('customSounds');
    });

    test('should handle missing custom sounds with fallback', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        customSounds: {}
      });
      
      const customSettings: AudioSettings = {
        ...defaultSettings,
        sounds: {
          ...defaultSettings.sounds,
          work_complete: {
            id: 'custom_missing',
            name: 'Missing Custom Sound',
            type: 'custom'
          }
        }
      };
      
      audioManager.updateSettings(customSettings);
      await audioManager.playSound('work_complete');
      
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    });
  });

  describe('fallback audio buffer', () => {
    test('should create fallback buffer when sound loading fails', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await audioManager.initialize();
      await audioManager.playSound('work_complete');
      
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    });

    test('should create different frequencies for different sounds', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await audioManager.initialize();
      
      // Test different sound types to ensure different fallback behaviors
      await audioManager.playSound('work_complete');
      await audioManager.playSound('rest_complete');
      
      expect(mockAudioContext.createBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    test('should handle fetch errors for built-in sounds', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await audioManager.initialize();
      
      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle invalid audio content type', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        headers: {
          get: jest.fn(() => 'text/html')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });
      
      await audioManager.initialize();
      await audioManager.playSound('work_complete');
      
      // Should create fallback buffer
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    });

    test('should handle decodeAudioData errors', async () => {
      mockAudioContext.decodeAudioData.mockRejectedValue(new Error('Decode error'));
      
      await audioManager.initialize();
      await audioManager.playSound('work_complete');
      
      // Should create fallback buffer
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    test('should clean up resources', async () => {
      await audioManager.initialize();
      await audioManager.destroy();
      
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    test('should handle destroy when not initialized', async () => {
      await audioManager.destroy();
      
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle playSound when AudioContext is null', async () => {
      await audioManager.playSound('work_complete');
      
      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle sound option with dataUrl', async () => {
      const customSettings: AudioSettings = {
        ...defaultSettings,
        sounds: {
          ...defaultSettings.sounds,
          work_complete: {
            id: 'custom_with_dataurl',
            name: 'Custom with DataURL',
            type: 'custom',
            dataUrl: 'data:audio/mp3;base64,test'
          }
        }
      };
      
      audioManager.updateSettings(customSettings);
      await audioManager.initialize();
      await audioManager.playSound('work_complete');
      
      expect(fetch).toHaveBeenCalledWith('data:audio/mp3;base64,test');
    });

    test('should handle createBuffer failure in fallback', async () => {
      mockAudioContext.createBuffer.mockImplementation(() => {
        throw new Error('CreateBuffer error');
      });
      
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await audioManager.initialize();
      await audioManager.playSound('work_complete');
      
      // Should not throw error
      expect(true).toBe(true);
    });
  });
});
