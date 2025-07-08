// src/offscreen/audio.ts
// Offscreen document for handling audio playback in Chrome Extension MV3

import { logger } from '@shared/logger';
import { SoundOption } from '@shared/audioTypes';

interface BuiltInSounds {
  [key: string]: {
    name: string;
    url: string;
  };
}

interface PlayAudioMessage {
  type: 'PLAY_AUDIO_OFFSCREEN';
  data: {
    soundOption: SoundOption;
    volume: number;
  };
}

class OffscreenAudioManager {
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();

  constructor() {
    logger.info('OffscreenAudioManager constructor called', undefined, 'AUDIO');
    this.setupMessageListener();
    this.initialize();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing OffscreenAudioManager', undefined, 'AUDIO');
    try {
      this.audioContext = new AudioContext();
      logger.info('Offscreen AudioContext initialized successfully', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate
      }, 'AUDIO');
    } catch (error) {
      logger.error('Failed to initialize AudioContext in offscreen document:', error, 'AUDIO');
    }
  }

  setupMessageListener(): void {
    logger.debug('Setting up message listener in offscreen document', undefined, 'SYSTEM');
    
    chrome.runtime.onMessage.addListener((message: PlayAudioMessage, sender, sendResponse) => {
      logger.debug('Offscreen audio received message:', {
        type: message.type,
        sender: sender
      }, 'AUDIO');
      
      if (message.type === 'PLAY_AUDIO_OFFSCREEN') {
        logger.info('Processing audio playback request:', {
          soundId: message.data.soundOption?.id,
          soundName: message.data.soundOption?.name,
          soundType: message.data.soundOption?.type,
          volume: message.data.volume
        }, 'AUDIO');
        
        this.playSound(message.data.soundOption, message.data.volume)
          .then(() => {
            logger.info('Audio playback completed successfully in offscreen document', undefined, 'AUDIO');
            sendResponse({ success: true });
          })
          .catch(error => {
            logger.error('Audio playback failed in offscreen document:', error, 'AUDIO');
            sendResponse({ success: false, error: error.message });
          });
        return true; // Will respond asynchronously
      }
      
      return false; // Not handling this message type
    });
  }

  async playSound(soundOption: SoundOption, volume: number = 70): Promise<void> {
    logger.debug(`Offscreen playSound called:`, {
      soundId: soundOption.id,
      soundName: soundOption.name,
      soundType: soundOption.type,
      volume: volume,
      contextState: this.audioContext?.state
    }, 'AUDIO');
    
    if (!this.audioContext) {
      const error = 'AudioContext not initialized in offscreen document';
      logger.error(error, undefined, 'AUDIO');
      throw new Error(error);
    }

    try {
      // Get or load sound buffer
      const soundBuffer = await this.getSoundBuffer(soundOption);
      
      if (soundBuffer) {
        logger.debug(`Sound buffer loaded, playing audio:`, {
          duration: soundBuffer.duration,
          sampleRate: soundBuffer.sampleRate,
          channels: soundBuffer.numberOfChannels
        }, 'AUDIO');
        
        await this.playAudioBuffer(soundBuffer, volume);
        logger.info(`Audio played successfully in offscreen: ${soundOption.id}`, undefined, 'AUDIO');
      } else {
        logger.warn(`No sound buffer available for ${soundOption.id}`, undefined, 'AUDIO');
      }
    } catch (error) {
      logger.error(`Failed to play sound ${soundOption.id} in offscreen:`, error, 'AUDIO');
      throw error;
    }
  }

  async getSoundBuffer(soundOption: SoundOption): Promise<AudioBuffer | null> {
    const soundId = soundOption.id;
    
    // Check if already loaded
    if (this.loadedSounds.has(soundId)) {
      logger.debug(`Using cached sound buffer for ${soundId} in offscreen`, undefined, 'AUDIO');
      return this.loadedSounds.get(soundId) || null;
    }

    // Load the sound
    logger.debug(`Loading sound buffer for ${soundId} in offscreen document`, undefined, 'AUDIO');
    try {
      let audioData: ArrayBuffer;

      if (soundOption.type === 'built-in') {
        const builtInSounds = this.getBuiltInSounds();
        const soundInfo = builtInSounds[soundId];
        if (!soundInfo) {
          logger.warn(`Built-in sound ${soundId} not found, creating fallback`, undefined, 'AUDIO');
          return this.createFallbackAudioBuffer(soundId);
        }

        logger.debug(`Fetching built-in sound file: ${soundInfo.url}`, undefined, 'AUDIO');
        const response = await fetch(chrome.runtime.getURL(soundInfo.url));
        
        if (!response.ok) {
          logger.warn(`Failed to load sound file ${soundId} (${response.status}), using fallback`, undefined, 'AUDIO');
          return this.createFallbackAudioBuffer(soundId);
        }

        audioData = await response.arrayBuffer();
        logger.debug(`Built-in sound ${soundId} loaded successfully, size: ${audioData.byteLength} bytes`, undefined, 'AUDIO');
      } else if (soundOption.dataUrl) {
        logger.debug(`Loading custom sound from data URL for ${soundId}`, undefined, 'AUDIO');
        const response = await fetch(soundOption.dataUrl);
        audioData = await response.arrayBuffer();
        logger.debug(`Custom sound ${soundId} loaded successfully, size: ${audioData.byteLength} bytes`, undefined, 'AUDIO');
      } else {
        logger.warn(`No valid sound source for ${soundId}, creating fallback`, undefined, 'AUDIO');
        return this.createFallbackAudioBuffer(soundId);
      }

      // Decode audio data
      logger.debug(`Decoding audio data for ${soundId}`, undefined, 'AUDIO');
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData);
      
      this.loadedSounds.set(soundId, audioBuffer);
      logger.debug(`Audio buffer decoded and cached for ${soundId}:`, {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      }, 'AUDIO');
      
      return audioBuffer;
    } catch (error) {
      logger.error(`Failed to load sound ${soundId} in offscreen:`, error, 'AUDIO');
      return this.createFallbackAudioBuffer(soundId);
    }
  }

  async playAudioBuffer(buffer: AudioBuffer, volume: number): Promise<void> {
    if (!this.audioContext) {
      logger.warn('No AudioContext available for playback in offscreen', undefined, 'AUDIO');
      return;
    }

    logger.debug(`Playing audio buffer in offscreen document:`, {
      contextState: this.audioContext.state,
      volume: volume,
      gainValue: volume / 100
    }, 'AUDIO');

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = volume / 100;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Add event listeners for debugging
    source.addEventListener('ended', () => {
      logger.debug('Offscreen audio playback finished', undefined, 'AUDIO');
    });
    
    source.addEventListener('error', (event) => {
      logger.error('Offscreen audio playback error:', event, 'AUDIO');
    });
    
    logger.debug('Starting offscreen audio playback', undefined, 'AUDIO');
    source.start();
    logger.debug('Offscreen audio playback started', undefined, 'AUDIO');
  }

  getBuiltInSounds(): BuiltInSounds {
    return {
      'chime': { name: 'Chime', url: 'sounds/chime.mp3' },
      'bell': { name: 'Bell', url: 'sounds/bell.mp3' },
      'ding': { name: 'Ding', url: 'sounds/ding.mp3' },
      'notification': { name: 'Notification', url: 'sounds/notification.mp3' },
      'nature_birds': { name: 'Birds', url: 'sounds/nature/birds.mp3' },
      'nature_water': { name: 'Water', url: 'sounds/nature/water.mp3' },
      'nature_wind': { name: 'Wind', url: 'sounds/nature/wind.mp3' },
      'minimal_click': { name: 'Click', url: 'sounds/minimal/click.mp3' },
      'minimal_pop': { name: 'Pop', url: 'sounds/minimal/pop.mp3' },
      'minimal_beep': { name: 'Beep', url: 'sounds/minimal/beep.mp3' }
    };
  }

  createFallbackAudioBuffer(soundId: string): AudioBuffer | null {
    if (!this.audioContext) {
      logger.warn('Cannot create fallback audio buffer - no AudioContext', undefined, 'AUDIO');
      return null;
    }

    try {
      logger.debug(`Creating fallback audio buffer for ${soundId} in offscreen`, undefined, 'AUDIO');
      
      const sampleRate = this.audioContext.sampleRate;
      const duration = 0.2; // 200ms
      const frameCount = sampleRate * duration;
      const audioBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      const frequencies: { [key: string]: number } = {
        'chime': 880,
        'bell': 660,
        'ding': 440,
        'notification': 550,
        'nature_birds': 800,
        'nature_water': 300,
        'nature_wind': 200,
        'minimal_click': 1000,
        'minimal_pop': 750,
        'minimal_beep': 600
      };

      const frequency = frequencies[soundId] || 440;
      
      logger.debug(`Generating fallback tone for ${soundId}:`, {
        frequency: frequency,
        duration: duration,
        sampleRate: sampleRate
      }, 'AUDIO');
      
      for (let i = 0; i < frameCount; i++) {
        const time = i / sampleRate;
        let amplitude = Math.sin(2 * Math.PI * frequency * time);
        
        const fadeTime = 0.02;
        if (time < fadeTime) {
          amplitude *= time / fadeTime;
        } else if (time > duration - fadeTime) {
          amplitude *= (duration - time) / fadeTime;
        }
        
        channelData[i] = amplitude * 0.1;
      }

      this.loadedSounds.set(soundId, audioBuffer);
      logger.debug(`Created and cached fallback audio buffer for ${soundId}`, undefined, 'AUDIO');
      return audioBuffer;
    } catch (error) {
      logger.error(`Failed to create fallback audio buffer for ${soundId}:`, error, 'AUDIO');
      return null;
    }
  }
}

// Initialize the offscreen audio manager
logger.info('Initializing OffscreenAudioManager', undefined, 'AUDIO');
new OffscreenAudioManager();