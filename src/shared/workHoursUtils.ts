import { WorkHours } from './types';

/**
 * Check if the current time is within work hours
 */
export function isWithinWorkHours(workHours: WorkHours, currentDate?: Date): boolean {
  if (!workHours.enabled) {
    return false; // If work hours are disabled, we're never "within" work hours
  }

  const now = currentDate || new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = formatTimeString(now.getHours(), now.getMinutes());

  // Check if today is a work day
  if (!workHours.days.includes(currentDay)) {
    return false;
  }

  // Parse start and end times
  const startTime = parseTimeString(workHours.startTime);
  const endTime = parseTimeString(workHours.endTime);
  const currentTimeMinutes = parseTimeString(currentTime);

  // Handle cases where work hours span midnight
  if (endTime <= startTime) {
    // Work hours span midnight (e.g., 22:00 to 06:00)
    return currentTimeMinutes >= startTime || currentTimeMinutes <= endTime;
  } else {
    // Normal work hours (e.g., 09:00 to 17:00)
    return currentTimeMinutes >= startTime && currentTimeMinutes <= endTime;
  }
}

/**
 * Check if blocking should be active based on work hours
 * If work hours are enabled, only block during work hours
 * If work hours are disabled, always allow blocking
 */
export function shouldBlockBasedOnWorkHours(workHours: WorkHours, currentDate?: Date): boolean {
  if (!workHours.enabled) {
    return true; // Work hours disabled, so blocking is always allowed
  }

  return isWithinWorkHours(workHours, currentDate);
}

/**
 * Get a human-readable description of work hours status
 */
export function getWorkHoursStatus(workHours: WorkHours, currentDate?: Date): string {
  if (!workHours.enabled) {
    return 'Work hours disabled - blocking active 24/7';
  }

  const isCurrentlyWithin = isWithinWorkHours(workHours, currentDate);
  
  if (isCurrentlyWithin) {
    return `Within work hours (${workHours.startTime} - ${workHours.endTime}) - blocking active`;
  } else {
    return `Outside work hours (${workHours.startTime} - ${workHours.endTime}) - blocking inactive`;
  }
}

/**
 * Get next work hours transition time
 */
export function getNextWorkHoursTransition(workHours: WorkHours, currentDate?: Date): { time: Date; entering: boolean } | null {
  if (!workHours.enabled) {
    return null;
  }

  const now = currentDate || new Date();
  const isCurrentlyWithin = isWithinWorkHours(workHours, now);
  
  // Find the next transition
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const checkDay = checkDate.getDay();
    
    if (workHours.days.includes(checkDay)) {
      const startTime = parseTimeString(workHours.startTime);
      const endTime = parseTimeString(workHours.endTime);
      
      // Check start time
      const startDateTime = new Date(checkDate);
      startDateTime.setHours(Math.floor(startTime / 60), startTime % 60, 0, 0);
      
      if (startDateTime > now) {
        return { time: startDateTime, entering: true };
      }
      
      // Check end time
      const endDateTime = new Date(checkDate);
      endDateTime.setHours(Math.floor(endTime / 60), endTime % 60, 0, 0);
      
      if (endDateTime > now && isCurrentlyWithin) {
        return { time: endDateTime, entering: false };
      }
    }
  }
  
  return null;
}

/**
 * Format time as HH:MM string
 */
function formatTimeString(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeString(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Validate time string format
 */
export function isValidTimeString(timeString: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}

/**
 * Get formatted day names for display
 */
export function getFormattedDays(days: number[]): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (days.length === 7) {
    return 'Every day';
  }
  
  if (days.length === 5 && days.every(day => day >= 1 && day <= 5)) {
    return 'Weekdays';
  }
  
  if (days.length === 2 && days.includes(0) && days.includes(6)) {
    return 'Weekends';
  }
  
  return days.map(day => dayNames[day]).join(', ');
}