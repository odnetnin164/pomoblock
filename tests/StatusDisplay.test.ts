import { StatusDisplay } from '@popup/components/StatusDisplay';

describe('StatusDisplay', () => {
  let statusDisplay: StatusDisplay;
  let statusElement: HTMLElement;
  let siteCountElement: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="status-element"></div>
      <div id="site-count-element"></div>
    `;
    
    statusElement = document.getElementById('status-element')!;
    siteCountElement = document.getElementById('site-count-element')!;
    
    // Create StatusDisplay instance
    statusDisplay = new StatusDisplay('status-element', 'site-count-element');
  });

  describe('Constructor', () => {
    test('should create StatusDisplay with valid element IDs', () => {
      expect(statusDisplay).toBeInstanceOf(StatusDisplay);
    });

    test('should log error when status element not found', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      new StatusDisplay('non-existent-status', 'site-count-element');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "StatusDisplay: Element with id 'non-existent-status' not found"
      );
      
      consoleSpy.mockRestore();
    });

    test('should log error when site count element not found', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      new StatusDisplay('status-element', 'non-existent-count');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "StatusDisplay: Element with id 'non-existent-count' not found"
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('updateSiteCount', () => {
    test('should update site count with only blocked sites', () => {
      statusDisplay.updateSiteCount(5);
      
      expect(statusElement.innerHTML).toBe(`
        <span id="siteCount">5</span> blocked
      `);
      
      const siteCountSpan = document.getElementById('siteCount');
      expect(siteCountSpan?.textContent).toBe('5');
    });

    test('should update site count with blocked and whitelisted sites', () => {
      statusDisplay.updateSiteCount(10, 3);
      
      expect(statusElement.innerHTML).toBe(`
        <span id="siteCount">10</span> blocked<br>
        <small>3 paths whitelisted</small>
      `);
      
      const siteCountSpan = document.getElementById('siteCount');
      expect(siteCountSpan?.textContent).toBe('10');
      
      const whitelistedText = statusElement.querySelector('small');
      expect(whitelistedText?.textContent).toBe('3 paths whitelisted');
    });

    test('should handle zero blocked sites', () => {
      statusDisplay.updateSiteCount(0);
      
      expect(statusElement.innerHTML).toBe(`
        <span id="siteCount">0</span> blocked
      `);
    });

    test('should handle zero whitelisted sites', () => {
      statusDisplay.updateSiteCount(5, 0);
      
      expect(statusElement.innerHTML).toBe(`
        <span id="siteCount">5</span> blocked
      `);
      
      expect(statusElement.innerHTML).not.toContain('whitelisted');
    });

    test('should handle null status element gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create instance with non-existent element
      const badStatusDisplay = new StatusDisplay('non-existent', 'site-count-element');
      
      // Should not throw error
      expect(() => {
        badStatusDisplay.updateSiteCount(5);
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'StatusDisplay: statusElement is null, cannot update site count'
      );
      
      consoleSpy.mockRestore();
    });

    test('should re-assign siteCountElement after updating innerHTML', () => {
      statusDisplay.updateSiteCount(7);
      
      // The siteCountElement should be updated to point to the new element
      const newSiteCountElement = document.getElementById('siteCount');
      expect(newSiteCountElement).toBeTruthy();
      expect(newSiteCountElement?.textContent).toBe('7');
    });
  });

  describe('Loading States', () => {
    test('should show loading state', () => {
      statusDisplay.showLoading();
      
      expect(statusElement.classList.contains('loading')).toBe(true);
    });

    test('should hide loading state', () => {
      // First add loading class
      statusElement.classList.add('loading');
      expect(statusElement.classList.contains('loading')).toBe(true);
      
      // Then hide it
      statusDisplay.hideLoading();
      
      expect(statusElement.classList.contains('loading')).toBe(false);
    });

    test('should handle loading operations with null status element', () => {
      // Create instance with non-existent element
      const badStatusDisplay = new StatusDisplay('non-existent', 'site-count-element');
      
      // Should not throw errors
      expect(() => {
        badStatusDisplay.showLoading();
        badStatusDisplay.hideLoading();
      }).not.toThrow();
    });

    test('should toggle loading state correctly', () => {
      // Initially no loading class
      expect(statusElement.classList.contains('loading')).toBe(false);
      
      // Show loading
      statusDisplay.showLoading();
      expect(statusElement.classList.contains('loading')).toBe(true);
      
      // Hide loading
      statusDisplay.hideLoading();
      expect(statusElement.classList.contains('loading')).toBe(false);
      
      // Show loading again
      statusDisplay.showLoading();
      expect(statusElement.classList.contains('loading')).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle multiple updates correctly', () => {
      // First update
      statusDisplay.updateSiteCount(3, 1);
      expect(statusElement.innerHTML).toContain('3');
      expect(statusElement.innerHTML).toContain('1 paths whitelisted');
      
      // Second update without whitelisted
      statusDisplay.updateSiteCount(8);
      expect(statusElement.innerHTML).toContain('8');
      expect(statusElement.innerHTML).not.toContain('whitelisted');
      
      // Third update with different values
      statusDisplay.updateSiteCount(15, 5);
      expect(statusElement.innerHTML).toContain('15');
      expect(statusElement.innerHTML).toContain('5 paths whitelisted');
    });

    test('should maintain loading state through site count updates', () => {
      // Set loading state
      statusDisplay.showLoading();
      expect(statusElement.classList.contains('loading')).toBe(true);
      
      // Update site count
      statusDisplay.updateSiteCount(5);
      
      // Loading state should be preserved
      expect(statusElement.classList.contains('loading')).toBe(true);
      
      // Hide loading
      statusDisplay.hideLoading();
      expect(statusElement.classList.contains('loading')).toBe(false);
    });
  });
});