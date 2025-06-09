// src/shared/pomodoroTypes.ts
// Pomodoro Timer Types

export type TimerState = 'STOPPED' | 'WORK' | 'REST' | 'PAUSED';

// Import from main types to avoid duplication
export { PomodoroSettings } from './types';

export interface TimerStatus {
  state: TimerState;
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  currentTask: string;
  sessionCount: number; // today's completed work sessions
  startTime?: number; // timestamp when current timer started
}

export interface PomodoroSession {
  id: string;
  type: 'WORK' | 'REST';
  duration: number; // actual duration in seconds
  plannedDuration: number; // planned duration in seconds
  task: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  completed: boolean; // true if timer ran to completion, false if manually stopped
  date: string; // YYYY-MM-DD format
}

export interface DailyStats {
  date: string; // YYYY-MM-DD format
  completedWorkSessions: number;
  completedRestSessions: number;
  totalWorkTime: number; // seconds
  totalRestTime: number; // seconds
  sessions: PomodoroSession[];
}

export interface PomodoroMessage {
  type: 'TIMER_UPDATE' | 'TIMER_COMPLETE' | 'SESSION_START' | 'SESSION_END';
  data: {
    timerStatus?: TimerStatus;
    session?: PomodoroSession;
    state?: TimerState;
    notification?: TimerNotification; // Add notification support
  };
}

export interface TimerNotification {
  title: string;
  message: string;
  type: 'work_complete' | 'rest_complete' | 'session_start';
}