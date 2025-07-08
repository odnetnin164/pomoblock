// src/shared/audioManager.ts
import { SoundType, SoundOption, AudioSettings, BuiltInSounds } from './audioTypes';
import { logger } from './logger';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();
  public settings: AudioSettings;
  private isInitialized = false;
  private readonly MAX_LOADED_SOUNDS = 20; // Limit to prevent memory bloat

  constructor(settings: AudioSettings) {
    this.settings = settings;
  }

  /**
   * Initialize audio context and preload sounds
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize AudioContext
      this.audioContext = new AudioContext();
      
      // Set up state change listeners
      this.audioContext.addEventListener('statechange', () => {
        logger.log(`AudioContext state changed to: ${this.audioContext?.state}`);
      });
      
      // Preload built-in sounds
      await this.preloadBuiltInSounds();
      
      // Preload custom sounds if any
      await this.preloadCustomSounds();
      
      this.isInitialized = true;
      logger.log('AudioManager initialized successfully');
    } catch (error) {
      logger.log('Failed to initialize AudioManager:', error);
      // Continue without audio
    }
  }

  /**
   * Play a sound for the specified type
   */
  async playSound(soundType: SoundType): Promise<void> {
    logger.info(`Audio playSound() called for type: ${soundType}`, {
      enabled: this.settings.enabled,
      volume: this.settings.volume,
      soundTheme: this.settings.soundTheme
    }, 'AUDIO');
    
    if (!this.settings.enabled) {
      logger.info(`Audio playback skipped - audio disabled (soundType: ${soundType})`, undefined, 'AUDIO');
      return;
    }

    // Ensure AudioContext is ready before playing
    const isReady = await this.ensureAudioContextReady();
    if (!isReady) {
      logger.warn(`AudioContext not ready, cannot play sound for ${soundType}`, undefined, 'AUDIO');
      return;
    }

    try {
      const soundOption = this.settings.sounds[soundType];
      logger.debug(`Playing sound for ${soundType}:`, {
        soundId: soundOption.id,
        soundName: soundOption.name,
        soundType: soundOption.type
      }, 'AUDIO');
      
      const soundBuffer = await this.getSoundBuffer(soundOption);
      
      if (soundBuffer) {
        await this.playAudioBuffer(soundBuffer);
        logger.info(`Audio played successfully for ${soundType} (${soundOption.name})`, undefined, 'AUDIO');
      } else {
        logger.warn(`No sound buffer available for ${soundType} (${soundOption.name})`, undefined, 'AUDIO');
      }
    } catch (error) {
      logger.error(`Failed to play sound for ${soundType}:`, error, 'AUDIO');
    }
  }

  /**
   * Update audio settings
   */
  updateSettings(newSettings: AudioSettings): void {
    this.settings = newSettings;
  }

  /**
   * Get sound buffer for a sound option
   */
  private async getSoundBuffer(soundOption: SoundOption): Promise<AudioBuffer | null> {
    const soundId = soundOption.id;
    
    // Check if already loaded
    if (this.loadedSounds.has(soundId)) {
      logger.log(`Using cached sound buffer for ${soundId}`);
      return this.loadedSounds.get(soundId) || null;
    }

    // Load the sound
    logger.log(`Loading sound buffer for ${soundId} (${soundOption.name})`);
    try {
      let audioData: ArrayBuffer;

      if (soundOption.type === 'built-in') {
        // Load built-in sound
        const builtInSounds = this.getBuiltInSounds();
        const soundInfo = builtInSounds[soundId];
        if (!soundInfo) return null;

        const response = await fetch(chrome.runtime.getURL(soundInfo.url));
        
        // Check if the response is actually an audio file
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('audio/')) {
          logger.log(`Sound file ${soundId} is not a valid audio file, using fallback`);
          return this.createFallbackAudioBuffer(soundId);
        }

        audioData = await response.arrayBuffer();
      } else if (soundOption.dataUrl) {
        // Load custom sound from data URL
        const response = await fetch(soundOption.dataUrl);
        audioData = await response.arrayBuffer();
      } else if (soundOption.type === 'custom' || soundId.startsWith('custom_')) {
        // Try to load custom sound from storage
        const customSoundData = await this.getCustomSoundDataUrl(soundId);
        if (customSoundData) {
          const response = await fetch(customSoundData);
          audioData = await response.arrayBuffer();
        } else {
          logger.log(`Custom sound ${soundId} not found in storage, using fallback`);
          return this.createFallbackAudioBuffer(soundId);
        }
      } else {
        return null;
      }

      // Decode audio data
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData);
      
      // Clean up old sounds before adding new one if needed
      this.cleanupOldSounds();
      
      this.loadedSounds.set(soundId, audioBuffer);
      return audioBuffer;
    } catch (error) {
      logger.log(`Failed to load sound ${soundId}:`, error);
      // Create a fallback audio buffer
      return this.createFallbackAudioBuffer(soundId);
    }
  }

  /**
   * Play an audio buffer
   */
  private async playAudioBuffer(buffer: AudioBuffer): Promise<void> {
    if (!this.audioContext) {
      logger.log('No AudioContext available for playback');
      return;
    }

    logger.log(`Playing audio buffer:`, {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      numberOfChannels: buffer.numberOfChannels,
      contextState: this.audioContext.state,
      volume: this.settings.volume
    });

    // Ensure AudioContext is running
    if (this.audioContext.state === 'suspended') {
      try {
        logger.log('Resuming suspended AudioContext');
        await this.audioContext.resume();
        logger.log('AudioContext resumed successfully');
      } catch (error) {
        logger.log('Failed to resume AudioContext:', error);
        return;
      }
    }

    // Check if AudioContext is in a valid state
    if (this.audioContext.state === 'closed') {
      logger.log('AudioContext is closed, cannot play audio');
      return;
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = this.settings.volume / 100;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Clean up nodes after playback finishes
    source.addEventListener('ended', () => {
      logger.log('Audio playback finished successfully');
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (error) {
        // Ignore disconnection errors if already disconnected
      }
    });
    
    // Also clean up if there's an error
    source.addEventListener('error', (event) => {
      logger.log('Audio playback error:', event);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (error) {
        // Ignore disconnection errors if already disconnected
      }
    });
    
    try {
      logger.log('Starting audio playback');
      source.start();
      logger.log('Audio playback started successfully');
    } catch (error) {
      logger.log('Failed to start audio source:', error);
      // Clean up on start failure
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (disconnectError) {
        // Ignore disconnection errors
      }
    }
  }

  /**
   * Preload built-in sounds
   */
  private async preloadBuiltInSounds(): Promise<void> {
    const builtInSounds = this.getBuiltInSounds();
    const loadPromises: Promise<void>[] = [];

    for (const [soundId, soundInfo] of Object.entries(builtInSounds)) {
      loadPromises.push(
        this.loadBuiltInSound(soundId, soundInfo.url).catch(error => {
          logger.log(`Failed to preload sound ${soundId}:`, error);
        })
      );
    }

    await Promise.all(loadPromises);
  }

  /**
   * Load a built-in sound
   */
  private async loadBuiltInSound(soundId: string, url: string): Promise<void> {
    if (!this.audioContext) return;

    try {
      const response = await fetch(chrome.runtime.getURL(url));
      const audioData = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      this.loadedSounds.set(soundId, audioBuffer);
    } catch (error) {
      logger.log(`Failed to load built-in sound ${soundId}:`, error);
    }
  }

  /**
   * Preload custom sounds
   */
  private async preloadCustomSounds(): Promise<void> {
    // Get custom sounds that have dataUrl in settings
    const customSounds = Object.values(this.settings.sounds).filter(
      sound => sound.type === 'custom' && sound.dataUrl
    );

    // Also check for custom sounds referenced by ID that need to be loaded from storage
    const customSoundIds = Object.values(this.settings.sounds)
      .filter(sound => sound.id.startsWith('custom_'))
      .map(sound => sound.id);

    const loadPromises: Promise<void>[] = [];

    // Load sounds with dataUrl
    customSounds.forEach(sound => {
      loadPromises.push(
        this.getSoundBuffer(sound).then(() => {}).catch(error => {
          logger.log(`Failed to preload custom sound ${sound.id}:`, error);
        })
      );
    });

    // Load custom sounds from storage
    for (const soundId of customSoundIds) {
      if (!customSounds.find(s => s.id === soundId)) {
        loadPromises.push(
          this.getSoundBuffer({ id: soundId, name: 'Custom Sound', type: 'custom' }).then(() => {}).catch(error => {
            logger.log(`Failed to preload custom sound ${soundId}:`, error);
          })
        );
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Get built-in sounds configuration
   */
  private getBuiltInSounds(): BuiltInSounds {
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

  /**
   * Get default audio settings
   */
  static getDefaultSettings(): AudioSettings {
    return {
      enabled: true,
      volume: 70,
      soundTheme: 'default',
      sounds: {
        work_complete: { id: 'chime', name: 'Chime', type: 'built-in' },
        rest_complete: { id: 'bell', name: 'Bell', type: 'built-in' },
        session_start: { id: 'ding', name: 'Ding', type: 'built-in' },
        tick: { id: 'minimal_click', name: 'Click', type: 'built-in' },
        warning: { id: 'notification', name: 'Notification', type: 'built-in' }
      }
    };
  }

  /**
   * Get sound themes
   */
  static getSoundThemes() {
    return {
      default: {
        name: 'Default',
        sounds: {
          work_complete: 'chime',
          rest_complete: 'bell',
          session_start: 'ding',
          tick: 'minimal_click',
          warning: 'notification'
        }
      },
      nature: {
        name: 'Nature',
        sounds: {
          work_complete: 'nature_birds',
          rest_complete: 'nature_water',
          session_start: 'nature_wind',
          tick: 'minimal_click',
          warning: 'notification'
        }
      },
      minimal: {
        name: 'Minimal',
        sounds: {
          work_complete: 'minimal_pop',
          rest_complete: 'minimal_beep',
          session_start: 'minimal_click',
          tick: 'minimal_click',
          warning: 'minimal_beep'
        }
      }
    };
  }

  /**
   * Create a fallback audio buffer with a simple tone
   */
  private createFallbackAudioBuffer(soundId: string): AudioBuffer | null {
    if (!this.audioContext) return null;

    try {
      // Create a short beep with different frequencies for different sounds
      const sampleRate = this.audioContext.sampleRate;
      const duration = 0.2; // 200ms
      const frameCount = sampleRate * duration;
      const audioBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Different frequencies for different sounds
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
      
      // Generate a simple sine wave with fade in/out
      for (let i = 0; i < frameCount; i++) {
        const time = i / sampleRate;
        let amplitude = Math.sin(2 * Math.PI * frequency * time);
        
        // Apply fade in/out to avoid clicks
        const fadeTime = 0.02; // 20ms fade
        if (time < fadeTime) {
          amplitude *= time / fadeTime;
        } else if (time > duration - fadeTime) {
          amplitude *= (duration - time) / fadeTime;
        }
        
        channelData[i] = amplitude * 0.1; // Low volume
      }

      // Clean up old sounds before adding new one if needed
      this.cleanupOldSounds();
      
      this.loadedSounds.set(soundId, audioBuffer);
      logger.log(`Created fallback audio buffer for ${soundId}`);
      return audioBuffer;
    } catch (error) {
      logger.log(`Failed to create fallback audio buffer for ${soundId}:`, error);
      return null;
    }
  }

  /**
   * Get custom sound data URL from Chrome storage
   */
  private async getCustomSoundDataUrl(soundId: string): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get('customSounds');
      const customSounds = result.customSounds || {};
      
      if (customSounds[soundId] && customSounds[soundId].dataUrl) {
        return customSounds[soundId].dataUrl;
      }
      
      return null;
    } catch (error) {
      logger.log(`Error retrieving custom sound ${soundId} from storage:`, error);
      return null;
    }
  }

  /**
   * Destroy audio manager
   */
  async destroy(): Promise<void> {
    if (this.audioContext) {
      // Remove event listeners before closing
      try {
        // Note: We can't remove event listeners from AudioContext as they don't support removeEventListener
        // But closing the context will clean them up
        await this.audioContext.close();
      } catch (error) {
        logger.log('Error closing AudioContext:', error);
      }
      this.audioContext = null;
    }
    this.loadedSounds.clear();
    this.isInitialized = false;
    logger.log('AudioManager destroyed');
  }

  /**
   * Check and recover AudioContext if needed
   */
  private async ensureAudioContextReady(): Promise<boolean> {
    if (!this.audioContext) {
      logger.log('AudioContext is null, attempting to recreate');
      try {
        this.audioContext = new AudioContext();
        this.audioContext.addEventListener('statechange', () => {
          logger.log(`AudioContext state changed to: ${this.audioContext?.state}`);
        });
        return true;
      } catch (error) {
        logger.log('Failed to recreate AudioContext:', error);
        return false;
      }
    }

    if (this.audioContext.state === 'closed') {
      logger.log('AudioContext is closed, attempting to recreate');
      try {
        this.audioContext = new AudioContext();
        this.audioContext.addEventListener('statechange', () => {
          logger.log(`AudioContext state changed to: ${this.audioContext?.state}`);
        });
        // Need to reload sounds since context was recreated
        this.loadedSounds.clear();
        await this.preloadBuiltInSounds();
        await this.preloadCustomSounds();
        return true;
      } catch (error) {
        logger.log('Failed to recreate AudioContext after closure:', error);
        return false;
      }
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        logger.log('AudioContext resumed successfully');
        return true;
      } catch (error) {
        logger.log('Failed to resume AudioContext:', error);
        return false;
      }
    }

    return this.audioContext.state === 'running';
  }

  /**
   * Handle page visibility changes to maintain AudioContext
   * Call this method when the page becomes visible again
   */
  async handleVisibilityChange(): Promise<void> {
    if (!this.isInitialized || !this.audioContext) return;

    // If the AudioContext was suspended while the page was hidden, try to resume it
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        logger.log('AudioContext resumed after visibility change');
      } catch (error) {
        logger.log('Failed to resume AudioContext after visibility change:', error);
      }
    }
  }

  /**
   * Get the current state of the AudioContext
   */
  getAudioContextState(): string {
    return this.audioContext?.state || 'null';
  }

  /**
   * Evict the oldest loaded sound to free up memory
   */
  private evictOldestSound(): void {
    const oldestSoundId = this.loadedSounds.keys().next().value;
    if (oldestSoundId) {
      this.loadedSounds.delete(oldestSoundId);
      logger.log(`Evicted oldest sound ${oldestSoundId} to free up memory`);
    }
  }

  /**
   * Clean up old sounds if we've exceeded the limit
   */
  private cleanupOldSounds(): void {
    if (this.loadedSounds.size >= this.MAX_LOADED_SOUNDS) {
      // Remove the oldest sounds (first ones added to the Map)
      const keysToRemove = Array.from(this.loadedSounds.keys()).slice(0, this.loadedSounds.size - this.MAX_LOADED_SOUNDS + 1);
      
      for (const key of keysToRemove) {
        this.loadedSounds.delete(key);
        logger.log(`Removed old sound from cache: ${key}`);
      }
    }
  }

  /**
   * Get diagnostic information about the AudioManager
   */
  getDiagnostics(): {
    isInitialized: boolean;
    audioContextState: string;
    loadedSoundsCount: number;
    loadedSoundIds: string[];
    maxLoadedSounds: number;
  } {
    return {
      isInitialized: this.isInitialized,
      audioContextState: this.getAudioContextState(),
      loadedSoundsCount: this.loadedSounds.size,
      loadedSoundIds: Array.from(this.loadedSounds.keys()),
      maxLoadedSounds: this.MAX_LOADED_SOUNDS
    };
  }
}