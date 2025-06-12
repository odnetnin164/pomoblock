import {
  isWithinWorkHours,
  shouldBlockBasedOnWorkHours,
  getWorkHoursStatus,
  getNextWorkHoursTransition,
  isValidTimeString,
  getFormattedDays
} from '@shared/workHoursUtils';
import { WorkHours } from '@shared/types';

describe('Work Hours Utils', () => {
  const defaultWorkHours: WorkHours = {
    enabled: true,
    startTime: '09:00',
    endTime: '17:00',
    days: [1, 2, 3, 4, 5] // Monday to Friday
  };

  describe('isWithinWorkHours', () => {
    test('should return false when work hours are disabled', () => {
      const workHours = { ...defaultWorkHours, enabled: false };
      const testDate = new Date('2024-01-15T10:00:00'); // Monday 10:00
      
      expect(isWithinWorkHours(workHours, testDate)).toBe(false);
    });

    test('should return true when current time is within work hours', () => {
      const testDate = new Date('2024-01-15T10:00:00'); // Monday 10:00
      
      expect(isWithinWorkHours(defaultWorkHours, testDate)).toBe(true);
    });

    test('should return false when current time is before work hours', () => {
      const testDate = new Date('2024-01-15T08:00:00'); // Monday 08:00
      
      expect(isWithinWorkHours(defaultWorkHours, testDate)).toBe(false);
    });

    test('should return false when current time is after work hours', () => {
      const testDate = new Date('2024-01-15T18:00:00'); // Monday 18:00
      
      expect(isWithinWorkHours(defaultWorkHours, testDate)).toBe(false);
    });

    test('should return false when current day is not a work day', () => {
      const testDate = new Date('2024-01-13T10:00:00'); // Saturday 10:00
      
      expect(isWithinWorkHours(defaultWorkHours, testDate)).toBe(false);
    });

    test('should return true at exact start time', () => {
      const testDate = new Date('2024-01-15T09:00:00'); // Monday 09:00
      
      expect(isWithinWorkHours(defaultWorkHours, testDate)).toBe(true);
    });

    test('should return true at exact end time', () => {
      const testDate = new Date('2024-01-15T17:00:00'); // Monday 17:00
      
      expect(isWithinWorkHours(defaultWorkHours, testDate)).toBe(true);
    });

    test('should handle work hours spanning midnight', () => {
      const nightWorkHours = {
        ...defaultWorkHours,
        startTime: '22:00',
        endTime: '06:00'
      };

      // Test during night shift
      const testDate1 = new Date('2024-01-15T23:00:00'); // Monday 23:00
      expect(isWithinWorkHours(nightWorkHours, testDate1)).toBe(true);

      // Test during early morning of night shift
      const testDate2 = new Date('2024-01-16T05:00:00'); // Tuesday 05:00
      expect(isWithinWorkHours(nightWorkHours, testDate2)).toBe(true);

      // Test outside night shift
      const testDate3 = new Date('2024-01-15T10:00:00'); // Monday 10:00
      expect(isWithinWorkHours(nightWorkHours, testDate3)).toBe(false);
    });

    test('should work with different day configurations', () => {
      const weekendWorkHours = {
        ...defaultWorkHours,
        days: [0, 6] // Sunday and Saturday
      };

      const testDate1 = new Date('2024-01-14T10:00:00'); // Sunday 10:00
      expect(isWithinWorkHours(weekendWorkHours, testDate1)).toBe(true);

      const testDate2 = new Date('2024-01-15T10:00:00'); // Monday 10:00
      expect(isWithinWorkHours(weekendWorkHours, testDate2)).toBe(false);
    });
  });

  describe('shouldBlockBasedOnWorkHours', () => {
    test('should return true when work hours are disabled', () => {
      const workHours = { ...defaultWorkHours, enabled: false };
      const testDate = new Date('2024-01-15T10:00:00');
      
      expect(shouldBlockBasedOnWorkHours(workHours, testDate)).toBe(true);
    });

    test('should return true when within work hours', () => {
      const testDate = new Date('2024-01-15T10:00:00'); // Monday 10:00
      
      expect(shouldBlockBasedOnWorkHours(defaultWorkHours, testDate)).toBe(true);
    });

    test('should return false when outside work hours', () => {
      const testDate = new Date('2024-01-15T18:00:00'); // Monday 18:00
      
      expect(shouldBlockBasedOnWorkHours(defaultWorkHours, testDate)).toBe(false);
    });
  });

  describe('getWorkHoursStatus', () => {
    test('should return disabled message when work hours are disabled', () => {
      const workHours = { ...defaultWorkHours, enabled: false };
      const testDate = new Date('2024-01-15T10:00:00');
      
      const status = getWorkHoursStatus(workHours, testDate);
      expect(status).toBe('Work hours disabled - blocking active 24/7');
    });

    test('should return within work hours message when active', () => {
      const testDate = new Date('2024-01-15T10:00:00'); // Monday 10:00
      
      const status = getWorkHoursStatus(defaultWorkHours, testDate);
      expect(status).toBe('Within work hours (09:00 - 17:00) - blocking active');
    });

    test('should return outside work hours message when inactive', () => {
      const testDate = new Date('2024-01-15T18:00:00'); // Monday 18:00
      
      const status = getWorkHoursStatus(defaultWorkHours, testDate);
      expect(status).toBe('Outside work hours (09:00 - 17:00) - blocking inactive');
    });
  });

  describe('getNextWorkHoursTransition', () => {
    test('should return null when work hours are disabled', () => {
      const workHours = { ...defaultWorkHours, enabled: false };
      const testDate = new Date('2024-01-15T10:00:00');
      
      const transition = getNextWorkHoursTransition(workHours, testDate);
      expect(transition).toBeNull();
    });

    test('should return next end time when currently within work hours', () => {
      const testDate = new Date('2024-01-15T10:00:00'); // Monday 10:00
      
      const transition = getNextWorkHoursTransition(defaultWorkHours, testDate);
      expect(transition).not.toBeNull();
      expect(transition!.entering).toBe(false);
      expect(transition!.time.getHours()).toBe(17);
      expect(transition!.time.getMinutes()).toBe(0);
    });

    test('should return next start time when currently outside work hours', () => {
      const testDate = new Date('2024-01-15T18:00:00'); // Monday 18:00
      
      const transition = getNextWorkHoursTransition(defaultWorkHours, testDate);
      expect(transition).not.toBeNull();
      expect(transition!.entering).toBe(true);
      expect(transition!.time.getHours()).toBe(9);
      expect(transition!.time.getMinutes()).toBe(0);
    });

    test('should find next work day when on weekend', () => {
      const testDate = new Date('2024-01-13T10:00:00'); // Saturday 10:00
      
      const transition = getNextWorkHoursTransition(defaultWorkHours, testDate);
      expect(transition).not.toBeNull();
      expect(transition!.entering).toBe(true);
      expect(transition!.time.getDay()).toBe(1); // Monday
    });
  });

  describe('isValidTimeString', () => {
    test('should return true for valid time strings', () => {
      expect(isValidTimeString('09:00')).toBe(true);
      expect(isValidTimeString('23:59')).toBe(true);
      expect(isValidTimeString('00:00')).toBe(true);
      expect(isValidTimeString('12:30')).toBe(true);
    });

    test('should return false for invalid time strings', () => {
      expect(isValidTimeString('24:00')).toBe(false);
      expect(isValidTimeString('12:60')).toBe(false);
      expect(isValidTimeString('9:00')).toBe(true); // Single digit hour is actually valid
      expect(isValidTimeString('09:0')).toBe(false); // Single digit minute without leading zero
      expect(isValidTimeString('abc:def')).toBe(false);
      expect(isValidTimeString('12')).toBe(false);
      expect(isValidTimeString('')).toBe(false);
    });
  });

  describe('getFormattedDays', () => {
    test('should return "Every day" for all days', () => {
      const allDays = [0, 1, 2, 3, 4, 5, 6];
      expect(getFormattedDays(allDays)).toBe('Every day');
    });

    test('should return "Weekdays" for Monday to Friday', () => {
      const weekdays = [1, 2, 3, 4, 5];
      expect(getFormattedDays(weekdays)).toBe('Weekdays');
    });

    test('should return "Weekends" for Saturday and Sunday', () => {
      const weekends = [0, 6];
      expect(getFormattedDays(weekends)).toBe('Weekends');
    });

    test('should return formatted day names for custom selections', () => {
      const customDays = [1, 3, 5]; // Monday, Wednesday, Friday
      expect(getFormattedDays(customDays)).toBe('Mon, Wed, Fri');
    });

    test('should return single day name', () => {
      const singleDay = [2]; // Tuesday
      expect(getFormattedDays(singleDay)).toBe('Tue');
    });

    test('should handle empty array', () => {
      expect(getFormattedDays([])).toBe('');
    });

    test('should handle unsorted days array', () => {
      const unsortedDays = [5, 1, 3]; // Friday, Monday, Wednesday
      expect(getFormattedDays(unsortedDays)).toBe('Fri, Mon, Wed');
    });
  });
});