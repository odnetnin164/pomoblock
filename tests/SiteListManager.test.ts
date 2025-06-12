import { SiteListManager } from '@options/SiteListManager';
import { StatusMessage } from '@shared/types';
import * as storage from '@shared/storage';
import * as urlUtils from '@shared/urlUtils';

// Mock dependencies
jest.mock('@shared/storage');
jest.mock('@shared/urlUtils');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockUrlUtils = urlUtils as jest.Mocked<typeof urlUtils>;

// Mock global confirm function
(global as any).confirm = jest.fn();

describe('SiteListManager', () => {
  let siteListManager: SiteListManager;
  let onStatusMessage: jest.Mock;
  let onSitesUpdated: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onStatusMessage = jest.fn();
    onSitesUpdated = jest.fn();
    siteListManager = new SiteListManager(onStatusMessage, onSitesUpdated);

    // Setup default mocks
    mockStorage.getBlockedWebsites.mockResolvedValue(['example.com', 'test.com']);
    mockStorage.getWhitelistedPaths.mockResolvedValue(['example.com/allowed', 'test.com/safe']);
    mockStorage.addBlockedWebsite.mockResolvedValue(['example.com', 'test.com']);
    mockStorage.removeBlockedWebsite.mockResolvedValue(['example.com']);
    mockStorage.addWhitelistedPath.mockResolvedValue(['example.com/allowed', 'test.com/safe']);
    mockStorage.removeWhitelistedPath.mockResolvedValue(['example.com/allowed']);
    mockStorage.clearAllBlockedWebsites.mockResolvedValue(undefined);
    mockStorage.clearAllWhitelistedPaths.mockResolvedValue(undefined);
    
    mockUrlUtils.cleanURL.mockImplementation((url: string) => url.toLowerCase().trim());
    mockUrlUtils.isValidDomain.mockReturnValue(true);
    mockUrlUtils.isValidPath.mockReturnValue(true);
    mockUrlUtils.getSiteType.mockReturnValue('Domain');
  });

  describe('Constructor', () => {
    test('should create SiteListManager with callbacks', () => {
      expect(siteListManager).toBeInstanceOf(SiteListManager);
    });

    test('should create SiteListManager without callbacks', () => {
      const managerWithoutCallbacks = new SiteListManager();
      expect(managerWithoutCallbacks).toBeInstanceOf(SiteListManager);
    });
  });

  describe('Loading Sites', () => {
    test('should load blocked websites successfully', async () => {
      const websites = await siteListManager.loadBlockedWebsites();
      
      expect(mockStorage.getBlockedWebsites).toHaveBeenCalled();
      expect(websites).toEqual(['example.com', 'test.com']);
    });

    test('should handle loading blocked websites error', async () => {
      mockStorage.getBlockedWebsites.mockRejectedValue(new Error('Storage error'));
      
      const websites = await siteListManager.loadBlockedWebsites();
      
      expect(websites).toEqual([]);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error loading blocked websites: Storage error',
        type: 'error'
      });
    });

    test('should load whitelisted paths successfully', async () => {
      const paths = await siteListManager.loadWhitelistedPaths();
      
      expect(mockStorage.getWhitelistedPaths).toHaveBeenCalled();
      expect(paths).toEqual(['example.com/allowed', 'test.com/safe']);
    });

    test('should handle loading whitelisted paths error', async () => {
      mockStorage.getWhitelistedPaths.mockRejectedValue(new Error('Storage error'));
      
      const paths = await siteListManager.loadWhitelistedPaths();
      
      expect(paths).toEqual([]);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error loading whitelisted paths: Storage error',
        type: 'error'
      });
    });
  });

  describe('Adding Blocked Sites', () => {
    test('should add new blocked site successfully', async () => {
      mockStorage.getBlockedWebsites.mockResolvedValue(['existing.com']);
      mockUrlUtils.cleanURL.mockReturnValue('newsite.com');
      mockUrlUtils.isValidDomain.mockReturnValue(true);
      
      const result = await siteListManager.addBlockedSite('  NewSite.com  ');
      
      expect(result).toBe(true);
      expect(mockUrlUtils.cleanURL).toHaveBeenCalledWith('  NewSite.com  ');
      expect(mockUrlUtils.isValidDomain).toHaveBeenCalledWith('newsite.com');
      expect(mockStorage.addBlockedWebsite).toHaveBeenCalledWith('newsite.com');
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Website added successfully!',
        type: 'success'
      });
      expect(onSitesUpdated).toHaveBeenCalled();
    });

    test('should reject empty website input', async () => {
      const result = await siteListManager.addBlockedSite('   ');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a website URL',
        type: 'error'
      });
      expect(mockStorage.addBlockedWebsite).not.toHaveBeenCalled();
    });

    test('should reject invalid domain', async () => {
      mockUrlUtils.isValidDomain.mockReturnValue(false);
      
      const result = await siteListManager.addBlockedSite('invalid-domain');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a valid domain or URL',
        type: 'error'
      });
      expect(mockStorage.addBlockedWebsite).not.toHaveBeenCalled();
    });

    test('should reject duplicate website', async () => {
      mockStorage.getBlockedWebsites.mockResolvedValue(['example.com']);
      mockUrlUtils.cleanURL.mockReturnValue('example.com');
      
      const result = await siteListManager.addBlockedSite('example.com');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Website is already blocked',
        type: 'error'
      });
      expect(mockStorage.addBlockedWebsite).not.toHaveBeenCalled();
    });

    test('should handle storage error when adding', async () => {
      mockStorage.getBlockedWebsites.mockResolvedValue([]);
      mockStorage.addBlockedWebsite.mockRejectedValue(new Error('Storage error'));
      
      const result = await siteListManager.addBlockedSite('newsite.com');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error adding website: Storage error',
        type: 'error'
      });
    });
  });

  describe('Adding Whitelisted Paths', () => {
    test('should add new whitelisted path successfully', async () => {
      mockStorage.getWhitelistedPaths.mockResolvedValue(['existing.com/path']);
      mockUrlUtils.cleanURL.mockReturnValue('site.com/newpath');
      mockUrlUtils.isValidPath.mockReturnValue(true);
      
      const result = await siteListManager.addWhitelistedPath('  Site.com/NewPath  ');
      
      expect(result).toBe(true);
      expect(mockUrlUtils.cleanURL).toHaveBeenCalledWith('  Site.com/NewPath  ');
      expect(mockUrlUtils.isValidPath).toHaveBeenCalledWith('site.com/newpath');
      expect(mockStorage.addWhitelistedPath).toHaveBeenCalledWith('site.com/newpath');
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Path whitelisted successfully!',
        type: 'success'
      });
      expect(onSitesUpdated).toHaveBeenCalled();
    });

    test('should reject empty path input', async () => {
      const result = await siteListManager.addWhitelistedPath('   ');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a path to whitelist',
        type: 'error'
      });
      expect(mockStorage.addWhitelistedPath).not.toHaveBeenCalled();
    });

    test('should reject invalid path', async () => {
      mockUrlUtils.isValidPath.mockReturnValue(false);
      
      const result = await siteListManager.addWhitelistedPath('invalid-path');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Please enter a valid domain/path combination',
        type: 'error'
      });
      expect(mockStorage.addWhitelistedPath).not.toHaveBeenCalled();
    });

    test('should reject duplicate path', async () => {
      mockStorage.getWhitelistedPaths.mockResolvedValue(['example.com/path']);
      mockUrlUtils.cleanURL.mockReturnValue('example.com/path');
      
      const result = await siteListManager.addWhitelistedPath('example.com/path');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Path is already whitelisted',
        type: 'error'
      });
      expect(mockStorage.addWhitelistedPath).not.toHaveBeenCalled();
    });

    test('should handle storage error when adding path', async () => {
      mockStorage.getWhitelistedPaths.mockResolvedValue([]);
      mockStorage.addWhitelistedPath.mockRejectedValue(new Error('Storage error'));
      
      const result = await siteListManager.addWhitelistedPath('site.com/path');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error whitelisting path: Storage error',
        type: 'error'
      });
    });
  });

  describe('Removing Sites', () => {
    test('should remove blocked site successfully', async () => {
      const result = await siteListManager.removeBlockedSite('example.com');
      
      expect(result).toBe(true);
      expect(mockStorage.removeBlockedWebsite).toHaveBeenCalledWith('example.com');
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Website removed successfully!',
        type: 'success'
      });
      expect(onSitesUpdated).toHaveBeenCalled();
    });

    test('should handle error when removing blocked site', async () => {
      mockStorage.removeBlockedWebsite.mockRejectedValue(new Error('Storage error'));
      
      const result = await siteListManager.removeBlockedSite('example.com');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error removing website: Storage error',
        type: 'error'
      });
    });

    test('should remove whitelisted path successfully', async () => {
      const result = await siteListManager.removeWhitelistedPath('example.com/path');
      
      expect(result).toBe(true);
      expect(mockStorage.removeWhitelistedPath).toHaveBeenCalledWith('example.com/path');
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Whitelisted path removed successfully!',
        type: 'success'
      });
      expect(onSitesUpdated).toHaveBeenCalled();
    });

    test('should handle error when removing whitelisted path', async () => {
      mockStorage.removeWhitelistedPath.mockRejectedValue(new Error('Storage error'));
      
      const result = await siteListManager.removeWhitelistedPath('example.com/path');
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error removing path: Storage error',
        type: 'error'
      });
    });
  });

  describe('Clearing All Sites', () => {
    test('should clear all blocked sites when confirmed', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      
      const result = await siteListManager.clearAllBlockedSites();
      
      expect(result).toBe(true);
      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to remove all blocked websites? This cannot be undone.');
      expect(mockStorage.clearAllBlockedWebsites).toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'All websites cleared!',
        type: 'success'
      });
      expect(onSitesUpdated).toHaveBeenCalled();
    });

    test('should not clear blocked sites when cancelled', async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);
      
      const result = await siteListManager.clearAllBlockedSites();
      
      expect(result).toBe(false);
      expect(mockStorage.clearAllBlockedWebsites).not.toHaveBeenCalled();
      expect(onStatusMessage).not.toHaveBeenCalled();
    });

    test('should handle error when clearing blocked sites', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      mockStorage.clearAllBlockedWebsites.mockRejectedValue(new Error('Storage error'));
      
      const result = await siteListManager.clearAllBlockedSites();
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error clearing websites: Storage error',
        type: 'error'
      });
    });

    test('should clear all whitelisted paths when confirmed', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      
      const result = await siteListManager.clearAllWhitelistedPaths();
      
      expect(result).toBe(true);
      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to remove all whitelisted paths? This cannot be undone.');
      expect(mockStorage.clearAllWhitelistedPaths).toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'All whitelisted paths cleared!',
        type: 'success'
      });
      expect(onSitesUpdated).toHaveBeenCalled();
    });

    test('should not clear whitelisted paths when cancelled', async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);
      
      const result = await siteListManager.clearAllWhitelistedPaths();
      
      expect(result).toBe(false);
      expect(mockStorage.clearAllWhitelistedPaths).not.toHaveBeenCalled();
      expect(onStatusMessage).not.toHaveBeenCalled();
    });

    test('should handle error when clearing whitelisted paths', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      mockStorage.clearAllWhitelistedPaths.mockRejectedValue(new Error('Storage error'));
      
      const result = await siteListManager.clearAllWhitelistedPaths();
      
      expect(result).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith({
        text: 'Error clearing paths: Storage error',
        type: 'error'
      });
    });
  });

  describe('Site Type Functions', () => {
    test('should get site type', () => {
      mockUrlUtils.getSiteType.mockReturnValue('Subreddit');
      
      const type = siteListManager.getSiteType('reddit.com/r/programming');
      
      expect(type).toBe('Subreddit');
      expect(mockUrlUtils.getSiteType).toHaveBeenCalledWith('reddit.com/r/programming');
    });

    test('should get site type labels', () => {
      const testCases = [
        { type: 'Subreddit', expected: 'Subreddit' },
        { type: 'Channel', expected: 'Channel' },
        { type: 'Profile', expected: 'Profile' },
        { type: 'Subdomain', expected: 'Subdomain' },
        { type: 'Path', expected: 'Path' },
        { type: 'Domain', expected: 'Domain' },
        { type: null, expected: '' }
      ];

      testCases.forEach(({ type, expected }) => {
        mockUrlUtils.getSiteType.mockReturnValue(type as any);
        const label = siteListManager.getSiteTypeLabel('test.com');
        expect(label).toBe(expected);
      });
    });
  });

  describe('Input Validation', () => {
    test('should validate domain input successfully', () => {
      mockUrlUtils.cleanURL.mockReturnValue('example.com');
      mockUrlUtils.isValidDomain.mockReturnValue(true);
      
      const result = siteListManager.validateInput('  Example.com  ');
      
      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
      expect(mockUrlUtils.cleanURL).toHaveBeenCalledWith('  Example.com  ');
      expect(mockUrlUtils.isValidDomain).toHaveBeenCalledWith('example.com');
    });

    test('should validate path input successfully', () => {
      mockUrlUtils.cleanURL.mockReturnValue('example.com/path');
      mockUrlUtils.isValidPath.mockReturnValue(true);
      
      const result = siteListManager.validateInput('  Example.com/Path  ', true);
      
      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
      expect(mockUrlUtils.cleanURL).toHaveBeenCalledWith('  Example.com/Path  ');
      expect(mockUrlUtils.isValidPath).toHaveBeenCalledWith('example.com/path');
    });

    test('should reject empty input', () => {
      const result = siteListManager.validateInput('   ');
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a URL');
    });

    test('should reject invalid domain', () => {
      mockUrlUtils.cleanURL.mockReturnValue('invalid');
      mockUrlUtils.isValidDomain.mockReturnValue(false);
      
      const result = siteListManager.validateInput('invalid');
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid domain format');
    });

    test('should reject invalid path', () => {
      mockUrlUtils.cleanURL.mockReturnValue('invalid');
      mockUrlUtils.isValidPath.mockReturnValue(false);
      
      const result = siteListManager.validateInput('invalid', true);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid domain/path format');
    });
  });

  describe('Callback Handling', () => {
    test('should handle missing status message callback gracefully', async () => {
      const managerWithoutCallback = new SiteListManager();
      
      // Should not throw error when trying to show status message
      expect(() => {
        (managerWithoutCallback as any).showStatusMessage({
          text: 'Test message',
          type: 'info'
        });
      }).not.toThrow();
    });

    test('should handle missing sites updated callback gracefully', async () => {
      const managerWithoutCallback = new SiteListManager();
      
      // Should not throw error when trying to notify sites updated
      expect(() => {
        (managerWithoutCallback as any).notifySitesUpdated();
      }).not.toThrow();
    });

    test('should call status message callback when provided', () => {
      const statusMessage: StatusMessage = {
        text: 'Test message',
        type: 'success'
      };
      
      (siteListManager as any).showStatusMessage(statusMessage);
      
      expect(onStatusMessage).toHaveBeenCalledWith(statusMessage);
    });

    test('should call sites updated callback when provided', () => {
      (siteListManager as any).notifySitesUpdated();
      
      expect(onSitesUpdated).toHaveBeenCalled();
    });
  });
});