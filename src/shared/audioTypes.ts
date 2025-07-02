// src/shared/audioTypes.ts
// Audio System Types

export type SoundType = 'work_complete' | 'rest_complete' | 'session_start' | 'tick' | 'warning';

export interface SoundOption {
  id: string;
  name: string;
  type: 'built-in' | 'custom';
  filename?: string; // For custom sounds
  dataUrl?: string; // For custom sounds stored as data URLs
}

export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0-100
  soundTheme: 'default' | 'nature' | 'minimal' | 'custom';
  sounds: {
    [K in SoundType]: SoundOption;
  };
}

export interface BuiltInSounds {
  [soundId: string]: {
    name: string;
    url: string;
  };
}

export interface AudioMessage {
  type: 'PLAY_SOUND' | 'PRELOAD_SOUNDS' | 'UPDATE_AUDIO_SETTINGS';
  data: {
    soundType?: SoundType;
    soundId?: string;
    volume?: number;
    settings?: AudioSettings;
  };
}