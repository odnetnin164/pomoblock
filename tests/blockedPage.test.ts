import { BlockedPageUI } from '@contentScript/ui/blockedPage';
import { ExtensionSettings } from '@shared/types';
import * as workHoursUtils from '@shared/workHoursUtils';

// Mock dependencies
jest.mock('@shared/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

jest.mock('@shared/workHoursUtils');

const mockWorkHoursUtils = workHoursUtils as jest.Mocked<typeof workHoursUtils>;

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    getURL: jest.fn(),
    sendMessage: jest.fn()
  }
};

(global as any).chrome = mockChrome;

describe('BlockedPageUI', () => {
  let blockedPageUI: BlockedPageUI;
  let mockSettings: ExtensionSettings;

  // Helper function to access Shadow DOM content
  const getShadowRoot = (): ShadowRoot | null => {
    // Access shadow root via component instance for closed shadow DOM
    return (blockedPageUI as any)._testShadowRoot || null;
  };

  // Helper function to query elements within Shadow DOM
  const queryShadow = (selector: string): Element | null => {
    const shadowRoot = getShadowRoot();
    return shadowRoot?.querySelector(selector) || null;
  };

  // Helper function to get element by ID within Shadow DOM
  const getElementByIdShadow = (id: string): HTMLElement | null => {
    const shadowRoot = getShadowRoot();
    return shadowRoot?.getElementById(id) || null;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fetch for CSS loading
    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue('/* mocked CSS */')
    } as any);
    
    // Setup DOM
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.title = 'Original Title';
    
    // Mock settings
    mockSettings = {
      blockMode: 'block',
      redirectUrl: 'https://example.com',
      redirectDelay: 3,
      extensionEnabled: true,
      debugEnabled: false,
      workHours: {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        days: [1, 2, 3, 4, 5]
      },
      pomodoro: {
        workDuration: 25,
        restDuration: 5,
        longRestDuration: 15,
        longRestInterval: 4,
        autoStartRest: true,
        autoStartWork: true,
        showNotifications: true,
        playSound: true
      }
    };

    // Setup mocks
    mockChrome.runtime.getURL.mockReturnValue('shared/blocked-page.css');
    mockWorkHoursUtils.getWorkHoursStatus.mockReturnValue('Currently within work hours');
    mockWorkHoursUtils.isWithinWorkHours.mockReturnValue(true);
    mockWorkHoursUtils.getFormattedDays.mockReturnValue('Mon-Fri');

    // Mock window methods using delete and reassign approach
    delete (window as any).location;
    (window as any).location = {
      hostname: 'example.com',
      pathname: '/test',
      href: 'https://example.com/test',
      replace: jest.fn()
    };

    delete (window as any).history;
    (window as any).history = {
      length: 2,
      back: jest.fn()
    };

    global.confirm = jest.fn().mockReturnValue(true);
    
    blockedPageUI = new BlockedPageUI(mockSettings);
  });

  afterEach(() => {
    // Clean up DOM - now looking for Shadow DOM host
    const overlayHost = document.getElementById('pomoblock-blocked-overlay-host');
    if (overlayHost) {
      overlayHost.remove();
    }
    
    // Legacy cleanup for old overlay structure (if any)
    const overlay = document.getElementById('pomoblock-blocked-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    const styles = document.getElementById('pomoblock-blocked-page-styles');
    if (styles) {
      styles.remove();
    }
    
    // Clean up timers if blockedPageUI exists
    if (blockedPageUI) {
      blockedPageUI.cleanup();
    }
  });

  describe('Constructor', () => {
    test('should create BlockedPageUI with settings', () => {
      expect(blockedPageUI).toBeInstanceOf(BlockedPageUI);
      expect(blockedPageUI.isPageBlocked()).toBe(false);
    });
  });

  describe('Settings Management', () => {
    test('should update settings', () => {
      const newSettings = { ...mockSettings, redirectUrl: 'https://newsite.com' };
      
      blockedPageUI.updateSettings(newSettings);
      
      // We can't directly test the internal settings, but we can test behavior
      expect(() => blockedPageUI.updateSettings(newSettings)).not.toThrow();
    });

    test.skip('should set timer state', () => {
      blockedPageUI.setTimerState('WORK');
      
      // Timer state affects the blocked page content
      blockedPageUI.createBlockedPage();
      
      expect(document.title).toBe('🍅 BLOCKED - Focus Time ');
      expect(blockedPageUI.isPageBlocked()).toBe(true);
    });
  });

  describe('Page Blocking', () => {
    test('should create blocked page overlay', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const overlayHost = document.getElementById('pomoblock-blocked-overlay-host');
      expect(overlayHost).toBeTruthy();
      expect(blockedPageUI.isPageBlocked()).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.title).toBe('🚫 BLOCKED - PomoBlock');
    });

    test('should not create duplicate overlay when already blocked', async () => {
      await blockedPageUI.createBlockedPage();
      const firstOverlay = document.getElementById('pomoblock-blocked-overlay-host');
      
      await blockedPageUI.createBlockedPage();
      const secondOverlay = document.getElementById('pomoblock-blocked-overlay-host');
      
      expect(firstOverlay).toBe(secondOverlay);
    });

    test('should load CSS into Shadow DOM', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const shadowRoot = getShadowRoot();
      const styleElement = shadowRoot?.querySelector('style');
      
      expect(styleElement).toBeTruthy();
      expect(styleElement?.textContent).toContain('/* mocked CSS */');
    });

    test('should remove blocked page overlay', async () => {
      await blockedPageUI.createBlockedPage();
      expect(blockedPageUI.isPageBlocked()).toBe(true);
      
      blockedPageUI.removeBlockedPage();
      
      const overlayHost = document.getElementById('pomoblock-blocked-overlay-host');
      expect(overlayHost).toBeNull();
      expect(blockedPageUI.isPageBlocked()).toBe(false);
      expect(document.body.style.overflow).toBe('');
      expect(document.title).toBe('Original Title');
    });

    test('should dispatch custom events when blocking/unblocking', async () => {
      const blockEventSpy = jest.spyOn(window, 'dispatchEvent');
      
      await blockedPageUI.createBlockedPage();
      blockedPageUI.removeBlockedPage();
      
      // Check that unblock event was dispatched
      expect(blockEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pomoblock-page-unblocked',
          detail: { blocked: false }
        })
      );
    });
  });

  describe('Timer State Handling', () => {
    test.skip('should update page title for WORK state', () => {
      blockedPageUI.setTimerState('WORK');
      blockedPageUI.createBlockedPage();
      
      expect(document.title).toBe('🍅 BLOCKED - Focus Time ');
    });

    test('should update page title for PAUSED state', async () => {
      blockedPageUI.setTimerState('PAUSED');
      await blockedPageUI.createBlockedPage();
      
      expect(document.title).toBe('⏸️ BLOCKED - Timer Paused');
    });

    test('should generate appropriate content for WORK state', async () => {
      blockedPageUI.setTimerState('WORK');
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const content = queryShadow('.blocked-content');
      expect(content?.innerHTML).toContain('Focus Time - Site Blocked');
      expect(content?.innerHTML).toContain('work session');
      expect(content?.innerHTML).toContain('🍅');
    });

    test('should generate appropriate content for PAUSED state', async () => {
      blockedPageUI.setTimerState('PAUSED');
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const content = queryShadow('.blocked-content');
      expect(content?.innerHTML).toContain('Timer Paused - Site Blocked');
      expect(content?.innerHTML).toContain('timer is currently paused');
      expect(content?.innerHTML).toContain('⏸️');
    });
  });

  describe('Work Hours Information', () => {
    test('should display work hours info when enabled', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const workHoursInfo = queryShadow('.work-hours-info');
      expect(workHoursInfo).toBeTruthy();
      expect(workHoursInfo?.innerHTML).toContain('Work Hours Status');
      expect(workHoursInfo?.innerHTML).toContain('09:00 - 17:00');
      expect(workHoursInfo?.innerHTML).toContain('Mon-Fri');
    });

    test('should not display work hours info when disabled', async () => {
      const settingsWithoutWorkHours = {
        ...mockSettings,
        workHours: { ...mockSettings.workHours, enabled: false }
      };
      
      blockedPageUI.updateSettings(settingsWithoutWorkHours);
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const workHoursInfo = queryShadow('.work-hours-info');
      expect(workHoursInfo).toBeNull();
    });

    test('should show active status when within work hours', async () => {
      mockWorkHoursUtils.isWithinWorkHours.mockReturnValue(true);
      
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const workHoursInfo = queryShadow('.work-hours-info');
      expect(workHoursInfo?.classList.contains('work-hours-active')).toBe(true);
      expect(workHoursInfo?.innerHTML).toContain('🟢');
    });

    test('should show inactive status when outside work hours', async () => {
      mockWorkHoursUtils.isWithinWorkHours.mockReturnValue(false);
      
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const workHoursInfo = queryShadow('.work-hours-info');
      expect(workHoursInfo?.classList.contains('work-hours-inactive')).toBe(true);
      expect(workHoursInfo?.innerHTML).toContain('🔴');
      expect(workHoursInfo?.innerHTML).toContain('only blocked during your work hours');
    });
  });

  describe('Redirect Mode', () => {
    test.skip('should handle immediate redirect when delay is 0', () => {
      const immediateSettings = { ...mockSettings, redirectDelay: 0 };
      blockedPageUI.updateSettings(immediateSettings);
      
      blockedPageUI.createBlockedPage(true);
      
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });

    test('should start countdown when redirect delay > 0', async () => {
      await blockedPageUI.createBlockedPage(true);
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const countdownElement = getElementByIdShadow('countdown-seconds');
      const progressBar = getElementByIdShadow('progress-bar');
      const cancelButton = getElementByIdShadow('cancel-redirect');
      
      expect(countdownElement?.textContent).toBe('3');
      expect(progressBar?.classList.contains('running')).toBe(true);
      expect(cancelButton).toBeTruthy();
    });

    test('should cancel redirect when cancel button clicked', async () => {
      await blockedPageUI.createBlockedPage(true);
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cancelButton = getElementByIdShadow('cancel-redirect') as HTMLButtonElement;
      expect(cancelButton).toBeTruthy();
      
      cancelButton.click();
      
      const redirectInfo = queryShadow('.redirect-info');
      expect(redirectInfo?.innerHTML).toContain('Redirect Cancelled');
    });

    test('should handle invalid redirect URL', () => {
      const invalidSettings = { ...mockSettings, redirectUrl: 'invalid-url' };
      blockedPageUI.updateSettings(invalidSettings);
      
      // This should not throw an error
      expect(() => {
        (blockedPageUI as any).handleRedirect();
      }).not.toThrow();
    });
  });

  describe('Navigation Actions', () => {
    test('should go back in history when go back button clicked', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const goBackBtn = getElementByIdShadow('go-back-btn') as HTMLButtonElement;
      expect(goBackBtn).toBeTruthy();
      
      goBackBtn.click();
      
      expect(window.history.back).toHaveBeenCalled();
      expect(blockedPageUI.isPageBlocked()).toBe(false);
    });

    test.skip('should redirect to safe page when safe page button clicked', () => {
      blockedPageUI.createBlockedPage();
      
      const redirectSafeBtn = document.getElementById('redirect-safe-btn') as HTMLButtonElement;
      expect(redirectSafeBtn).toBeTruthy();
      
      redirectSafeBtn.click();
      
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });

    test('should attempt to close tab when close button clicked', async () => {
      const closeSpy = jest.spyOn(window, 'close').mockImplementation();
      
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const closeTabBtn = getElementByIdShadow('close-tab-btn') as HTMLButtonElement;
      expect(closeTabBtn).toBeTruthy();
      
      closeTabBtn.click();
      
      expect(closeSpy).toHaveBeenCalled();
    });

    test('should handle escape key press', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      expect(window.history.back).toHaveBeenCalled();
    });

    test.skip('should handle case with no history', () => {
      // Mock window.history with no history
      (window as any).history = { length: 1, back: jest.fn() };
      
      blockedPageUI.createBlockedPage();
      
      const goBackBtn = document.getElementById('go-back-btn') as HTMLButtonElement;
      goBackBtn.click();
      
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('Error Handling', () => {
    test('should handle chrome.runtime.sendMessage errors', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Runtime error');
      });
      
      // Should not throw error
      await expect(blockedPageUI.createBlockedPage()).resolves.not.toThrow();
    });

    test.skip('should handle window.history.back errors', () => {
      // Mock window.history with error-throwing back method
      (window as any).history = {
        length: 2,
        back: jest.fn().mockImplementation(() => {
          throw new Error('History error');
        })
      };
      
      blockedPageUI.createBlockedPage();
      const goBackBtn = document.getElementById('go-back-btn') as HTMLButtonElement;
      
      // Should not throw error and should fallback to safe page
      expect(() => goBackBtn.click()).not.toThrow();
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });

    test.skip('should use fallback URL when redirect URL is invalid', () => {
      const settingsWithEmptyUrl = { ...mockSettings, redirectUrl: '' };
      blockedPageUI.updateSettings(settingsWithEmptyUrl);
      
      blockedPageUI.createBlockedPage();
      const redirectSafeBtn = document.getElementById('redirect-safe-btn') as HTMLButtonElement;
      redirectSafeBtn.click();
      
      expect(window.location.replace).toHaveBeenCalledWith('https://www.google.com');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly', async () => {
      await blockedPageUI.createBlockedPage(true);
      expect(blockedPageUI.isPageBlocked()).toBe(true);
      
      blockedPageUI.cleanup();
      
      const overlayHost = document.getElementById('pomoblock-blocked-overlay-host');
      expect(overlayHost).toBeNull();
      expect(blockedPageUI.isPageBlocked()).toBe(false);
    });

    test('should clear intervals on cleanup', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await blockedPageUI.createBlockedPage(true);
      
      // Give time for interval to be created
      await new Promise(resolve => setTimeout(resolve, 100));
      
      blockedPageUI.cleanup();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    test('should remove event listeners on cleanup', async () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      await blockedPageUI.createBlockedPage();
      blockedPageUI.cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Content Generation', () => {
    test.skip('should include current URL in blocked content', () => {
      blockedPageUI.createBlockedPage();
      
      const blockedSite = document.querySelector('.blocked-site');
      expect(blockedSite?.textContent).toContain('example.com/test');
    });

    test('should include timestamp in footer', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const footer = queryShadow('.blocked-footer');
      expect(footer?.textContent).toContain('Blocked at:');
    });

    test('should include navigation buttons', async () => {
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(getElementByIdShadow('go-back-btn')).toBeTruthy();
      expect(getElementByIdShadow('redirect-safe-btn')).toBeTruthy();
      expect(getElementByIdShadow('close-tab-btn')).toBeTruthy();
    });
  });

  describe('Timer Integration', () => {
    test('should show timer info for WORK state', async () => {
      blockedPageUI.setTimerState('WORK');
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const timerInfo = queryShadow('.blocked-timer-info');
      expect(timerInfo).toBeTruthy();
      expect(timerInfo?.innerHTML).toContain('Pomodoro Timer Active');
      expect(timerInfo?.innerHTML).toContain('work session');
    });

    test('should show different timer info for PAUSED state', async () => {
      blockedPageUI.setTimerState('PAUSED');
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const timerInfo = queryShadow('.blocked-timer-info');
      expect(timerInfo).toBeTruthy();
      expect(timerInfo?.innerHTML).toContain('Timer Paused');
      expect((timerInfo as HTMLElement)?.style.background).toContain('rgba(255, 152, 0, 0.2)');
    });

    test('should not show timer info for STOPPED state', async () => {
      blockedPageUI.setTimerState('STOPPED');
      await blockedPageUI.createBlockedPage();
      
      // Wait for async CSS loading and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const timerInfo = queryShadow('.blocked-timer-info');
      expect(timerInfo).toBeNull();
    });
  });
});