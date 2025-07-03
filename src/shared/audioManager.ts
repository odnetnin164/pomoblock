// src/shared/audioManager.ts
import { SoundType, SoundOption, AudioSettings, BuiltInSounds } from './audioTypes';
import { logger } from './logger';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();
  public settings: AudioSettings;
  private isInitialized = false;

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
    if (!this.settings.enabled || !this.audioContext) {
      return;
    }

    try {
      const soundOption = this.settings.sounds[soundType];
      const soundBuffer = await this.getSoundBuffer(soundOption);
      
      if (soundBuffer) {
        await this.playAudioBuffer(soundBuffer);
      }
    } catch (error) {
      logger.log(`Failed to play sound for ${soundType}:`, error);
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
      return this.loadedSounds.get(soundId) || null;
    }

    // Load the sound
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
    if (!this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = this.settings.volume / 100;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start();
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
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.loadedSounds.clear();
    this.isInitialized = false;
  }
}