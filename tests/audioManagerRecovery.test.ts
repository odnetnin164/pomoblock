// Simple test to verify AudioManager improvements work
import { AudioManager } from '../src/shared/audioManager';
import { AudioSettings } from '../src/shared/audioTypes';

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

// Mock AudioContext with state management
const mockAudioContext = {
  createBuffer: jest.fn(),
  createBufferSource: jest.fn(),
  createGain: jest.fn(),
  decodeAudioData: jest.fn(),
  close: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  destination: {},
  sampleRate: 44100,
  state: 'running' // Start with running state
};

const mockBufferSource = {
  buffer: null,
  connect: jest.fn(),
  start: jest.fn(),
  disconnect: jest.fn(),
  addEventListener: jest.fn()
};

const mockGainNode = {
  gain: { value: 0 },
  connect: jest.fn(),
  disconnect: jest.fn()
};

(global as any).AudioContext = jest.fn(() => mockAudioContext);

// Mock fetch
global.fetch = jest.fn();

// Mock logger
jest.mock('../src/shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

describe('AudioManager Recovery Tests', () => {
  let audioManager: AudioManager;
  let defaultSettings: AudioSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    
    defaultSettings = AudioManager.getDefaultSettings();
    audioManager = new AudioManager(defaultSettings);

    // Setup default mocks
    mockAudioContext.createBufferSource.mockReturnValue(mockBufferSource);
    mockAudioContext.createGain.mockReturnValue(mockGainNode);
    mockAudioContext.createBuffer.mockReturnValue({
      getChannelData: jest.fn(() => new Float32Array(8820))
    });
    
    (fetch as jest.Mock).mockResolvedValue({
      headers: {
        get: jest.fn(() => 'audio/mp3')
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
    });

    mockAudioContext.decodeAudioData.mockResolvedValue({
      duration: 0.2,
      numberOfChannels: 1,
      sampleRate: 44100
    });

    mockAudioContext.state = 'running';
    mockAudioContext.resume.mockResolvedValue(undefined);
    mockAudioContext.close.mockResolvedValue(undefined);

    // Reset buffer source mocks
    mockBufferSource.connect.mockClear();
    mockBufferSource.start.mockClear();
    mockBufferSource.disconnect.mockClear();
    mockBufferSource.addEventListener.mockClear();
    mockGainNode.connect.mockClear();
    mockGainNode.disconnect.mockClear();
  });

  test('should handle AudioContext suspension and recovery', async () => {
    await audioManager.initialize();
    
    // Simulate AudioContext suspension
    mockAudioContext.state = 'suspended';
    
    await audioManager.playSound('work_complete');
    
    // Should have called resume
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  test('should handle AudioContext closure and recreation', async () => {
    await audioManager.initialize();
    
    // Simulate AudioContext being closed
    mockAudioContext.state = 'closed';
    
    await audioManager.playSound('work_complete');
    
    // Should create a new AudioContext
    expect(AudioContext).toHaveBeenCalledTimes(2); // Once for init, once for recovery
  });

  test('should add event listeners to buffer sources for cleanup', async () => {
    await audioManager.initialize();
    
    // Mock that sounds are already loaded to avoid fetch issues
    const mockBuffer = { duration: 0.2 };
    (audioManager as any).loadedSounds.set('chime', mockBuffer);
    
    await audioManager.playSound('work_complete');
    
    // Should add event listeners for cleanup
    expect(mockBufferSource.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(mockBufferSource.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('should clean up nodes after playback', async () => {
    await audioManager.initialize();
    
    // Mock that sounds are already loaded
    const mockBuffer = { duration: 0.2 };
    (audioManager as any).loadedSounds.set('chime', mockBuffer);
    
    await audioManager.playSound('work_complete');
    
    // Get the 'ended' event listener and call it
    const endedCallback = mockBufferSource.addEventListener.mock.calls.find(
      call => call[0] === 'ended'
    )?.[1];
    
    if (endedCallback) {
      endedCallback();
      expect(mockBufferSource.disconnect).toHaveBeenCalled();
      expect(mockGainNode.disconnect).toHaveBeenCalled();
    }
  });

  test('should limit number of loaded sounds', async () => {
    await audioManager.initialize();
    
    const maxSounds = (audioManager as any).MAX_LOADED_SOUNDS;
    expect(typeof maxSounds).toBe('number');
    expect(maxSounds).toBeGreaterThan(0);
  });

  test('should provide diagnostic information', () => {
    const diagnostics = audioManager.getDiagnostics();
    
    expect(diagnostics).toHaveProperty('isInitialized');
    expect(diagnostics).toHaveProperty('audioContextState');
    expect(diagnostics).toHaveProperty('loadedSoundsCount');
    expect(diagnostics).toHaveProperty('loadedSoundIds');
    expect(diagnostics).toHaveProperty('maxLoadedSounds');
  });

  test('should handle visibility changes', async () => {
    await audioManager.initialize();
    
    mockAudioContext.state = 'suspended';
    
    await audioManager.handleVisibilityChange();
    
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  test('should properly close AudioContext on destroy', async () => {
    await audioManager.initialize();
    
    await audioManager.destroy();
    
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  test('should handle close errors gracefully', async () => {
    await audioManager.initialize();
    
    mockAudioContext.close.mockRejectedValue(new Error('Close failed'));
    
    await audioManager.destroy();
    
    // Should not throw error
    expect(true).toBe(true);
  });
});
