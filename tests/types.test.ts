import {
  WorkHours,
  PomodoroSettings,
  ExtensionSettings,
  StorageData,
  SiteType,
  SiteInfo,
  BlockType,
  BlockOption,
  StatusMessageType,
  StatusMessage,
  BlockTarget,
  WhitelistTarget,
  DebugLogEntry,
  ContentScriptMessageType,
  ContentScriptMessage
} from '@shared/types';

describe('Types', () => {
  describe('WorkHours Interface', () => {
    test('should accept valid work hours object', () => {
      const workHours: WorkHours = {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: [1, 2, 3, 4, 5]
      };
      
      expect(workHours.enabled).toBe(true);
      expect(workHours.startTime).toBe('09:00');
      expect(workHours.endTime).toBe('17:00');
      expect(workHours.days).toEqual([1, 2, 3, 4, 5]);
    });

    test('should support all days of the week', () => {
      const workHours: WorkHours = {
        enabled: true,
        startTime: '08:00',
        endTime: '18:00',
        days: [0, 1, 2, 3, 4, 5, 6] // Sunday through Saturday
      };
      
      expect(workHours.days).toHaveLength(7);
      expect(workHours.days).toContain(0); // Sunday
      expect(workHours.days).toContain(6); // Saturday
    });

    test('should support disabled work hours', () => {
      const workHours: WorkHours = {
        enabled: false,
        startTime: '',
        endTime: '',
        days: []
      };
      
      expect(workHours.enabled).toBe(false);
    });
  });

  describe('PomodoroSettings Interface', () => {
    test('should accept valid pomodoro settings', () => {
      const settings: PomodoroSettings = {
        workDuration: 25,
        restDuration: 5,
        longRestDuration: 15,
        longRestInterval: 4,
        autoStartRest: true,
        autoStartWork: true,
        showNotifications: true,
        playSound: true
      };
      
      expect(settings.workDuration).toBe(25);
      expect(settings.restDuration).toBe(5);
      expect(settings.longRestDuration).toBe(15);
      expect(settings.longRestInterval).toBe(4);
      expect(settings.autoStartRest).toBe(true);
    });

    test('should support custom durations', () => {
      const settings: PomodoroSettings = {
        workDuration: 45,
        restDuration: 10,
        longRestDuration: 30,
        longRestInterval: 3,
        autoStartRest: false,
        autoStartWork: false,
        showNotifications: false,
        playSound: false
      };
      
      expect(settings.workDuration).toBe(45);
      expect(settings.longRestInterval).toBe(3);
      expect(settings.autoStartRest).toBe(false);
    });
  });

  describe('ExtensionSettings Interface', () => {
    test('should accept complete extension settings', () => {
      const workHours: WorkHours = {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: [1, 2, 3, 4, 5]
      };

      const pomodoro: PomodoroSettings = {
        workDuration: 25,
        restDuration: 5,
        longRestDuration: 15,
        longRestInterval: 4,
        autoStartRest: true,
        autoStartWork: true,
        showNotifications: true,
        playSound: true
      };

      const settings: ExtensionSettings = {
        blockMode: 'block',
        redirectUrl: 'https://example.com',
        redirectDelay: 3,
        extensionEnabled: true,
        debugEnabled: false,
        workHours,
        pomodoro
      };
      
      expect(settings.blockMode).toBe('block');
      expect(settings.redirectUrl).toBe('https://example.com');
      expect(settings.redirectDelay).toBe(3);
      expect(settings.extensionEnabled).toBe(true);
      expect(settings.workHours).toEqual(workHours);
      expect(settings.pomodoro).toEqual(pomodoro);
    });

    test('should support redirect mode', () => {
      const settings: ExtensionSettings = {
        blockMode: 'redirect',
        redirectUrl: 'https://productive-site.com',
        redirectDelay: 5,
        extensionEnabled: true,
        debugEnabled: true,
        workHours: { enabled: false, startTime: '', endTime: '', days: [] },
        pomodoro: {
          workDuration: 30,
          restDuration: 7,
          longRestDuration: 20,
          longRestInterval: 3,
          autoStartRest: false,
          autoStartWork: false,
          showNotifications: false,
          playSound: false
        }
      };
      
      expect(settings.blockMode).toBe('redirect');
      expect(settings.debugEnabled).toBe(true);
    });
  });

  describe('SiteInfo Interface', () => {
    test('should accept valid site info', () => {
      const siteInfo: SiteInfo = {
        url: 'https://example.com/path',
        type: 'Domain',
        hostname: 'example.com',
        pathname: '/path',
        normalizedUrl: 'example.com/path'
      };
      
      expect(siteInfo.url).toBe('https://example.com/path');
      expect(siteInfo.type).toBe('Domain');
      expect(siteInfo.hostname).toBe('example.com');
      expect(siteInfo.pathname).toBe('/path');
      expect(siteInfo.normalizedUrl).toBe('example.com/path');
    });

    test('should support all site types', () => {
      const siteTypes: SiteType[] = ['Subreddit', 'Channel', 'Profile', 'Subdomain', 'Path', 'Domain'];
      
      siteTypes.forEach(type => {
        const siteInfo: SiteInfo = {
          url: 'https://example.com',
          type,
          hostname: 'example.com',
          pathname: '/',
          normalizedUrl: 'example.com'
        };
        
        expect(siteInfo.type).toBe(type);
      });
    });

    test('should support null type', () => {
      const siteInfo: SiteInfo = {
        url: 'https://example.com',
        type: null,
        hostname: 'example.com',
        pathname: '/',
        normalizedUrl: 'example.com'
      };
      
      expect(siteInfo.type).toBeNull();
    });
  });

  describe('BlockOption Interface', () => {
    test('should accept valid block options', () => {
      const blockTypes: BlockType[] = ['domain', 'subdomain', 'path', 'page'];
      
      blockTypes.forEach(type => {
        const option: BlockOption = {
          type,
          label: `Block ${type}`,
          target: 'example.com',
          description: `Block the entire ${type}`
        };
        
        expect(option.type).toBe(type);
        expect(option.label).toContain(type);
      });
    });
  });

  describe('StatusMessage Interface', () => {
    test('should accept all status message types', () => {
      const messageTypes: StatusMessageType[] = ['success', 'error', 'info'];
      
      messageTypes.forEach(type => {
        const message: StatusMessage = {
          text: `Test ${type} message`,
          type
        };
        
        expect(message.type).toBe(type);
        expect(message.text).toContain(type);
      });
    });

    test('should support optional duration', () => {
      const messageWithDuration: StatusMessage = {
        text: 'Test message',
        type: 'success',
        duration: 5000
      };
      
      const messageWithoutDuration: StatusMessage = {
        text: 'Test message',
        type: 'error'
      };
      
      expect(messageWithDuration.duration).toBe(5000);
      expect(messageWithoutDuration.duration).toBeUndefined();
    });
  });

  describe('BlockTarget Interface', () => {
    test('should accept valid block target', () => {
      const blockTarget: BlockTarget = {
        target: 'example.com',
        label: 'Example Domain',
        isSpecialSite: false,
        isWhitelisted: false,
        isBlocked: true
      };
      
      expect(blockTarget.target).toBe('example.com');
      expect(blockTarget.label).toBe('Example Domain');
      expect(blockTarget.isSpecialSite).toBe(false);
      expect(blockTarget.isWhitelisted).toBe(false);
      expect(blockTarget.isBlocked).toBe(true);
    });

    test('should support special site configuration', () => {
      const specialTarget: BlockTarget = {
        target: 'reddit.com',
        label: 'Reddit',
        isSpecialSite: true,
        isWhitelisted: true,
        isBlocked: false
      };
      
      expect(specialTarget.isSpecialSite).toBe(true);
      expect(specialTarget.isWhitelisted).toBe(true);
      expect(specialTarget.isBlocked).toBe(false);
    });
  });

  describe('WhitelistTarget Interface', () => {
    test('should accept valid whitelist target', () => {
      const whitelistTarget: WhitelistTarget = {
        target: '/important-path',
        label: 'Important Path'
      };
      
      expect(whitelistTarget.target).toBe('/important-path');
      expect(whitelistTarget.label).toBe('Important Path');
    });
  });

  describe('DebugLogEntry Interface', () => {
    test('should accept debug log entry', () => {
      const logEntry: DebugLogEntry = {
        timestamp: new Date('2023-01-01T12:00:00Z'),
        message: 'Debug message',
        data: { key: 'value' }
      };
      
      expect(logEntry.timestamp).toBeInstanceOf(Date);
      expect(logEntry.message).toBe('Debug message');
      expect(logEntry.data).toEqual({ key: 'value' });
    });

    test('should support optional data field', () => {
      const logEntryWithoutData: DebugLogEntry = {
        timestamp: new Date(),
        message: 'Simple message'
      };
      
      const logEntryWithData: DebugLogEntry = {
        timestamp: new Date(),
        message: 'Complex message',
        data: { complex: true, count: 42 }
      };
      
      expect(logEntryWithoutData.data).toBeUndefined();
      expect(logEntryWithData.data).toBeDefined();
    });
  });

  describe('ContentScriptMessage Interface', () => {
    test('should accept all content script message types', () => {
      const messageTypes: ContentScriptMessageType[] = [
        'SITE_BLOCKED',
        'REDIRECT_STARTED', 
        'REDIRECT_CANCELLED',
        'DEBUG_LOG',
        'TIMER_UPDATE',
        'TIMER_COMPLETE',
        'SESSION_START',
        'SESSION_END'
      ];
      
      messageTypes.forEach(type => {
        const message: ContentScriptMessage = {
          type
        };
        
        expect(message.type).toBe(type);
      });
    });

    test('should support optional data field', () => {
      const messageWithoutData: ContentScriptMessage = {
        type: 'SITE_BLOCKED'
      };
      
      const messageWithData: ContentScriptMessage = {
        type: 'TIMER_UPDATE',
        data: { timeRemaining: 1500, state: 'WORK' }
      };
      
      expect(messageWithoutData.data).toBeUndefined();
      expect(messageWithData.data).toBeDefined();
      expect(messageWithData.data.timeRemaining).toBe(1500);
    });
  });

  describe('StorageData Interface', () => {
    test('should accept partial storage data', () => {
      const storageData: StorageData = {
        blockedWebsitesArray: ['example.com', 'test.com'],
        blockMode: 'redirect',
        redirectUrl: 'https://productive.com',
        extensionEnabled: true
      };
      
      expect(storageData.blockedWebsitesArray).toEqual(['example.com', 'test.com']);
      expect(storageData.blockMode).toBe('redirect');
      expect(storageData.redirectUrl).toBe('https://productive.com');
      expect(storageData.extensionEnabled).toBe(true);
    });

    test('should support complete storage data', () => {
      const pomodoroSettings: PomodoroSettings = {
        workDuration: 25,
        restDuration: 5,
        longRestDuration: 15,
        longRestInterval: 4,
        autoStartRest: true,
        autoStartWork: true,
        showNotifications: true,
        playSound: true
      };

      const storageData: StorageData = {
        blockedWebsitesArray: ['example.com'],
        whitelistedPathsArray: ['/allowed'],
        blockMode: 'block',
        redirectUrl: 'https://example.com',
        redirectDelay: 3,
        extensionEnabled: true,
        debugEnabled: false,
        workHoursEnabled: true,
        workHoursStartTime: '09:00',
        workHoursEndTime: '17:00',
        workHoursDays: [1, 2, 3, 4, 5],
        pomodoroSettings,
        pomodoroTimerStatus: { state: 'WORK' },
        pomodoroDailyStats: { completedSessions: 3 },
        pomodoroSessionsHistory: [],
        pomodoroCurrentSession: null
      };
      
      expect(storageData).toBeDefined();
      expect(storageData.pomodoroSettings).toEqual(pomodoroSettings);
      expect(storageData.workHoursDays).toEqual([1, 2, 3, 4, 5]);
    });

    test('should support empty storage data', () => {
      const storageData: StorageData = {};
      
      expect(storageData).toBeDefined();
      expect(Object.keys(storageData)).toHaveLength(0);
    });
  });

  describe('Type Validation and Edge Cases', () => {
    test('should enforce block mode values', () => {
      // This test verifies that TypeScript will catch invalid block modes at compile time
      const validModes = ['block', 'redirect'] as const;
      
      validModes.forEach(mode => {
        const settings: Pick<ExtensionSettings, 'blockMode'> = {
          blockMode: mode
        };
        expect(['block', 'redirect']).toContain(settings.blockMode);
      });
    });

    test('should handle boolean flags correctly', () => {
      const booleanFields = {
        extensionEnabled: true,
        debugEnabled: false,
        autoStartRest: true,
        autoStartWork: false,
        showNotifications: true,
        playSound: false
      };
      
      Object.entries(booleanFields).forEach(([key, value]) => {
        expect(typeof value).toBe('boolean');
      });
    });

    test('should handle numeric fields correctly', () => {
      const numericFields = {
        workDuration: 25,
        restDuration: 5,
        longRestDuration: 15,
        longRestInterval: 4,
        redirectDelay: 3
      };
      
      Object.entries(numericFields).forEach(([key, value]) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    test('should handle array fields correctly', () => {
      const arrayFields = {
        days: [1, 2, 3, 4, 5],
        blockedWebsitesArray: ['example.com', 'test.com'],
        whitelistedPathsArray: ['/path1', '/path2']
      };
      
      Object.entries(arrayFields).forEach(([key, value]) => {
        expect(Array.isArray(value)).toBe(true);
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });
});