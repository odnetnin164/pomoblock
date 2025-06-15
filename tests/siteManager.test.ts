import { SiteManager } from '../src/popup/components/SiteManager';
import { BlockType } from '../src/shared/types';

// Mock the storage functions
jest.mock('../src/shared/storage', () => ({
  addBlockedWebsite: jest.fn().mockResolvedValue(['example.com']),
  addWhitelistedPath: jest.fn().mockResolvedValue(['example.com/path']),
  removeWhitelistedPath: jest.fn().mockResolvedValue([])
}));

describe('SiteManager - Block Type Selection', () => {
  let siteManager: SiteManager;

  beforeEach(() => {
    siteManager = new SiteManager();
  });

  describe('block options generation', () => {
    test('should generate block options for YouTube subdomain', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      const options = siteManager.getBlockOptions();
      
      expect(options.length).toBeGreaterThan(1);
      
      // Should have domain, subdomain, path, and page options
      const types = options.map(opt => opt.type);
      expect(types).toContain('domain');
      expect(types).toContain('subdomain');
      expect(types).toContain('path');
      expect(types).toContain('page');
    });

    test('should set default block type to domain', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      expect(siteManager.getSelectedBlockType()).toBe('domain');
    });

    test('should update selected block type', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      siteManager.setSelectedBlockType('subdomain');
      expect(siteManager.getSelectedBlockType()).toBe('subdomain');
    });

    test('should return correct target for selected block type', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      // Test domain selection
      siteManager.setSelectedBlockType('domain');
      expect(siteManager.getSelectedBlockTarget()).toBe('youtube.com');
      
      // Test subdomain selection
      siteManager.setSelectedBlockType('subdomain');
      expect(siteManager.getSelectedBlockTarget()).toBe('music.youtube.com');
    });
  });

  describe('subdomain whitelist options', () => {
    test('should generate subdomain whitelist options when main domain is blocked', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      const blockedDomains = ['youtube.com', 'facebook.com'];
      const whitelistOptions = siteManager.getSubdomainWhitelistOptions(blockedDomains);
      
      expect(whitelistOptions).toHaveLength(1);
      expect(whitelistOptions[0]).toEqual({
        type: 'subdomain',
        label: 'Whitelist music.youtube.com',
        target: 'music.youtube.com',
        description: 'Allow music.youtube.com while keeping youtube.com blocked'
      });
    });

    test('should return empty array when main domain is not blocked', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      const blockedDomains = ['facebook.com', 'twitter.com'];
      const whitelistOptions = siteManager.getSubdomainWhitelistOptions(blockedDomains);
      
      expect(whitelistOptions).toHaveLength(0);
    });

    test('should return empty array for non-subdomain sites', () => {
      const testUrl = 'https://example.com/';
      siteManager.setCurrentTab(testUrl);
      
      const blockedDomains = ['example.com'];
      const whitelistOptions = siteManager.getSubdomainWhitelistOptions(blockedDomains);
      
      expect(whitelistOptions).toHaveLength(0);
    });
  });

  describe('blocking actions with selected type', () => {
    test('should block using selected target', async () => {
      const { addBlockedWebsite } = require('../src/shared/storage');
      
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      // Select subdomain blocking
      siteManager.setSelectedBlockType('subdomain');
      
      await siteManager.addToBlockedList();
      
      expect(addBlockedWebsite).toHaveBeenCalledWith('music.youtube.com');
    });

    test('should whitelist using selected target', async () => {
      const { addWhitelistedPath } = require('../src/shared/storage');
      
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      // Select path whitelisting
      siteManager.setSelectedBlockType('path');
      
      await siteManager.addToWhitelist();
      
      expect(addWhitelistedPath).toHaveBeenCalledWith('music.youtube.com/watch');
    });
  });

  describe('site information', () => {
    test('should return current site info', () => {
      const testUrl = 'https://music.youtube.com/watch?v=abc123';
      siteManager.setCurrentTab(testUrl);
      
      const siteInfo = siteManager.getCurrentSiteInfo();
      
      expect(siteInfo).toEqual({
        url: testUrl,
        hostname: 'music.youtube.com',
        pathname: '/watch'
      });
    });

    test('should handle invalid URLs gracefully', () => {
      siteManager.setCurrentTab('invalid-url');
      
      const siteInfo = siteManager.getCurrentSiteInfo();
      expect(siteInfo).toBeNull();
      
      const blockTarget = siteManager.getBlockTarget();
      expect(blockTarget).toBeNull();
      
      const blockOptions = siteManager.getBlockOptions();
      expect(blockOptions).toEqual([]);
    });
  });

  describe('whitelist matching', () => {
    test('should find matching whitelist entry', () => {
      const testUrl = 'https://music.youtube.com/watch';
      siteManager.setCurrentTab(testUrl);
      
      const whitelistedPaths = [
        'music.youtube.com/watch',
        'facebook.com',
        'reddit.com/r/programming'
      ];
      
      const matchingEntry = siteManager.findMatchingWhitelistEntry(whitelistedPaths);
      expect(matchingEntry).toBe('music.youtube.com/watch');
    });

    test('should return null when no whitelist entry matches', () => {
      const testUrl = 'https://music.youtube.com/playlist';
      siteManager.setCurrentTab(testUrl);
      
      const whitelistedPaths = [
        'music.youtube.com/watch',
        'facebook.com'
      ];
      
      const matchingEntry = siteManager.findMatchingWhitelistEntry(whitelistedPaths);
      expect(matchingEntry).toBeNull();
    });

    test('should find matching domain-only whitelist entry', () => {
      const testUrl = 'https://subdomain.example.com/path';
      siteManager.setCurrentTab(testUrl);
      
      const whitelistedPaths = ['example.com'];
      const matchingEntry = siteManager.findMatchingWhitelistEntry(whitelistedPaths);
      
      expect(matchingEntry).toBe('example.com');
    });

    test('should match domain exactly for domain-only whitelist', () => {
      const testUrl = 'https://example.com/path';
      siteManager.setCurrentTab(testUrl);
      
      const whitelistedPaths = ['example.com'];
      const matchingEntry = siteManager.findMatchingWhitelistEntry(whitelistedPaths);
      
      expect(matchingEntry).toBe('example.com');
    });
  });

  describe('removeFromWhitelist', () => {
    test('should remove matching whitelist entry', async () => {
      const { removeWhitelistedPath } = require('../src/shared/storage');
      
      const testUrl = 'https://music.youtube.com/watch';
      siteManager.setCurrentTab(testUrl);
      
      const whitelistedPaths = ['music.youtube.com/watch', 'facebook.com'];
      
      await siteManager.removeFromWhitelist(whitelistedPaths);
      
      expect(removeWhitelistedPath).toHaveBeenCalledWith('music.youtube.com/watch');
    });

    test('should throw error when no matching entry found', async () => {
      const testUrl = 'https://music.youtube.com/playlist';
      siteManager.setCurrentTab(testUrl);
      
      const whitelistedPaths = ['music.youtube.com/watch'];
      
      await expect(siteManager.removeFromWhitelist(whitelistedPaths))
        .rejects.toThrow('No matching whitelist entry found');
    });
  });

  describe('checkIfWouldBeBlocked', () => {
    test('should return true if site would be blocked', () => {
      const testUrl = 'https://youtube.com/watch?v=123';
      siteManager.setCurrentTab(testUrl);
      
      const blockedWebsites = ['youtube.com', 'facebook.com'];
      const wouldBeBlocked = siteManager.checkIfWouldBeBlocked(blockedWebsites);
      
      expect(wouldBeBlocked).toBe(true);
    });

    test('should return false if site would not be blocked', () => {
      const testUrl = 'https://example.com/';
      siteManager.setCurrentTab(testUrl);
      
      const blockedWebsites = ['youtube.com', 'facebook.com'];
      const wouldBeBlocked = siteManager.checkIfWouldBeBlocked(blockedWebsites);
      
      expect(wouldBeBlocked).toBe(false);
    });

    test('should return false for invalid URL', () => {
      siteManager.setCurrentTab('invalid-url');
      
      const blockedWebsites = ['youtube.com'];
      const wouldBeBlocked = siteManager.checkIfWouldBeBlocked(blockedWebsites);
      
      expect(wouldBeBlocked).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should throw error when trying to block with no target', async () => {
      siteManager.setCurrentTab('invalid-url');
      
      await expect(siteManager.addToBlockedList())
        .rejects.toThrow('No target to block');
    });

    test('should throw error when trying to whitelist with no target', async () => {
      siteManager.setCurrentTab('invalid-url');
      
      await expect(siteManager.addToWhitelist())
        .rejects.toThrow('No target to whitelist');
    });
  });
});