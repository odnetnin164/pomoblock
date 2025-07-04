// src/offscreen/audio.js
// Offscreen document for handling audio playback

class OffscreenAudioManager {
  constructor() {
    this.audioContext = null;
    this.loadedSounds = new Map();
    this.setupMessageListener();
    this.initialize();
  }

  async initialize() {
    try {
      this.audioContext = new AudioContext();
      console.log('Offscreen AudioContext initialized');
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PLAY_AUDIO_OFFSCREEN') {
        this.playSound(message.data.soundOption, message.data.volume)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
      }
    });
  }

  async playSound(soundOption, volume = 70) {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    try {
      // Get or load sound buffer
      const soundBuffer = await this.getSoundBuffer(soundOption);
      
      if (soundBuffer) {
        await this.playAudioBuffer(soundBuffer, volume);
        console.log(`Audio played: ${soundOption.id}`);
      }
    } catch (error) {
      console.error(`Failed to play sound ${soundOption.id}:`, error);
      throw error;
    }
  }

  async getSoundBuffer(soundOption) {
    const soundId = soundOption.id;
    
    // Check if already loaded
    if (this.loadedSounds.has(soundId)) {
      return this.loadedSounds.get(soundId);
    }

    // Load the sound
    try {
      let audioData;

      if (soundOption.type === 'built-in') {
        const builtInSounds = this.getBuiltInSounds();
        const soundInfo = builtInSounds[soundId];
        if (!soundInfo) {
          return this.createFallbackAudioBuffer(soundId);
        }

        const response = await fetch(chrome.runtime.getURL(soundInfo.url));
        
        if (!response.ok) {
          console.log(`Failed to load sound file ${soundId}, using fallback`);
          return this.createFallbackAudioBuffer(soundId);
        }

        audioData = await response.arrayBuffer();
      } else if (soundOption.dataUrl) {
        const response = await fetch(soundOption.dataUrl);
        audioData = await response.arrayBuffer();
      } else {
        return this.createFallbackAudioBuffer(soundId);
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      this.loadedSounds.set(soundId, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load sound ${soundId}:`, error);
      return this.createFallbackAudioBuffer(soundId);
    }
  }

  async playAudioBuffer(buffer, volume) {
    if (!this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = volume / 100;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start();
  }

  getBuiltInSounds() {
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

  createFallbackAudioBuffer(soundId) {
    if (!this.audioContext) return null;

    try {
      const sampleRate = this.audioContext.sampleRate;
      const duration = 0.2; // 200ms
      const frameCount = sampleRate * duration;
      const audioBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      const frequencies = {
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
      console.log(`Created fallback audio buffer for ${soundId}`);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to create fallback audio buffer for ${soundId}:`, error);
      return null;
    }
  }
}

// Initialize the offscreen audio manager
new OffscreenAudioManager();
