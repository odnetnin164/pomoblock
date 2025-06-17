import { BlockingEngine } from '../src/contentScript/blockingEngine';

describe.skip('BlockingEngine - Subdomain Whitelisting', () => {
  let blockingEngine: BlockingEngine;
  let originalLocation: Location;

  beforeAll(() => {
    originalLocation = window.location;
  });

  afterAll(() => {
    (window as any).location = originalLocation;
  });

  beforeEach(() => {
    blockingEngine = new BlockingEngine();
    
    // Mock window.location with a plain object
    delete (window as any).location;
    (window as any).location = {
      href: 'https://music.youtube.com/watch?v=abc123',
      hostname: 'music.youtube.com',
      pathname: '/watch',
      search: '?v=abc123',
      hash: ''
    };
  });

  describe('subdomain blocking with whitelisting', () => {
    test('should block subdomain when main domain is blocked and subdomain not whitelisted', () => {
      // Block main domain
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths([]);
      
      // music.youtube.com should be blocked
      expect(blockingEngine.shouldBlockWebsite()).toBe(true);
    });

    test('should not block subdomain when it is specifically whitelisted', () => {
      // Block main domain but whitelist specific subdomain
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com']);
      
      // music.youtube.com should not be blocked due to whitelist
      expect(blockingEngine.shouldBlockWebsite()).toBe(false);
    });

    test('should still block other subdomains when one is whitelisted', () => {
      // Set up for gaming.youtube.com
      (window as any).location.hostname = 'gaming.youtube.com';
      (window as any).location.href = 'https://gaming.youtube.com/';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com']);
      
      // gaming.youtube.com should still be blocked
      expect(blockingEngine.shouldBlockWebsite()).toBe(true);
    });

    test('should handle path-specific whitelisting', () => {
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com/watch']);
      
      // music.youtube.com/watch should not be blocked
      expect(blockingEngine.shouldBlockWebsite()).toBe(false);
    });

    test('should block when path does not match whitelist', () => {
      (window as any).location.pathname = '/playlist';
      (window as any).location.href = 'https://music.youtube.com/playlist';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com/watch']);
      
      // music.youtube.com/playlist should be blocked (path doesn't match)
      expect(blockingEngine.shouldBlockWebsite()).toBe(true);
    });

    test('should handle case insensitive matching', () => {
      (window as any).location.hostname = 'Music.YouTube.com';
      (window as any).location.href = 'https://Music.YouTube.com/';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com']);
      
      expect(blockingEngine.shouldBlockWebsite()).toBe(false);
    });

    test('should work with complex subdomain hierarchies', () => {
      (window as any).location.hostname = 'api.v2.music.youtube.com';
      (window as any).location.href = 'https://api.v2.music.youtube.com/';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['api.v2.music.youtube.com']);
      
      expect(blockingEngine.shouldBlockWebsite()).toBe(false);
    });
  });

  describe('isWhitelistedPath', () => {
    test('should match exact domain whitelist', () => {
      (window as any).location.hostname = 'music.youtube.com';
      (window as any).location.pathname = '/';
      (window as any).location.href = 'https://music.youtube.com/';
      
      blockingEngine.updateWhitelistedPaths(['music.youtube.com']);
      
      expect(blockingEngine.isWhitelistedPath()).toBe(true);
    });

    test('should not do subdomain matching for whitelist entries', () => {
      (window as any).location.hostname = 'music.youtube.com';
      (window as any).location.href = 'https://music.youtube.com/';
      
      // Whitelist main domain but current site is subdomain
      blockingEngine.updateWhitelistedPaths(['youtube.com']);
      
      // Should NOT match - we don't want youtube.com whitelist to affect subdomains
      expect(blockingEngine.isWhitelistedPath()).toBe(false);
    });

    test('should match path-specific whitelist', () => {
      (window as any).location.hostname = 'music.youtube.com';
      (window as any).location.pathname = '/watch';
      (window as any).location.href = 'https://music.youtube.com/watch';
      
      blockingEngine.updateWhitelistedPaths(['music.youtube.com/watch']);
      
      expect(blockingEngine.isWhitelistedPath()).toBe(true);
    });

    test('should match path prefix', () => {
      (window as any).location.hostname = 'music.youtube.com';
      (window as any).location.pathname = '/watch/playlist';
      (window as any).location.href = 'https://music.youtube.com/watch/playlist';
      
      blockingEngine.updateWhitelistedPaths(['music.youtube.com/watch']);
      
      expect(blockingEngine.isWhitelistedPath()).toBe(true);
    });
  });

  describe('getCurrentSiteInfo', () => {
    test('should return normalized site information', () => {
      const siteInfo = blockingEngine.getCurrentSiteInfo();
      
      expect(siteInfo).toEqual({
        hostname: 'music.youtube.com',
        pathname: '/watch',
        url: 'https://music.youtube.com/watch?v=abc123'
      });
    });
  });
});

describe('BlockingEngine - Consolidated Methods', () => {
  let blockingEngine: BlockingEngine;

  beforeEach(() => {
    blockingEngine = new BlockingEngine();
    
    // Set up test data
    blockingEngine.updateBlockedSites(['youtube.com', 'facebook.com', 'reddit.com/r/gaming']);
    blockingEngine.updateWhitelistedPaths(['music.youtube.com', 'facebook.com/pages']);
    blockingEngine.updateBlockedSitesToggleState({
      'youtube.com': true,
      'facebook.com': false, // Disabled
      'reddit.com/r/gaming': true
    });
    blockingEngine.updateWhitelistedPathsToggleState({
      'music.youtube.com': true,
      'facebook.com/pages': false // Disabled
    });
  });

  describe('toggle state methods', () => {
    test('isBlockedSiteEnabled should return correct state', () => {
      expect(blockingEngine.isBlockedSiteEnabled('youtube.com')).toBe(true);
      expect(blockingEngine.isBlockedSiteEnabled('facebook.com')).toBe(false);
      expect(blockingEngine.isBlockedSiteEnabled('nonexistent.com')).toBe(true); // Default
    });

    test('isWhitelistedPathEnabled should return correct state', () => {
      expect(blockingEngine.isWhitelistedPathEnabled('music.youtube.com')).toBe(true);
      expect(blockingEngine.isWhitelistedPathEnabled('facebook.com/pages')).toBe(false);
      expect(blockingEngine.isWhitelistedPathEnabled('nonexistent.com')).toBe(true); // Default
    });

    test('isSiteInBlocklist should check presence in blocklist', () => {
      expect(blockingEngine.isSiteInBlocklist('youtube.com')).toBe(true);
      expect(blockingEngine.isSiteInBlocklist('YOUTUBE.COM')).toBe(true); // Case insensitive
      expect(blockingEngine.isSiteInBlocklist('twitter.com')).toBe(false);
    });

    test('isPathInWhitelist should check presence in whitelist', () => {
      expect(blockingEngine.isPathInWhitelist('music.youtube.com')).toBe(true);
      expect(blockingEngine.isPathInWhitelist('MUSIC.YOUTUBE.COM')).toBe(true); // Case insensitive
      expect(blockingEngine.isPathInWhitelist('gaming.youtube.com')).toBe(false);
    });
  });

  describe('getSiteInfo', () => {
    test('should parse URL correctly', () => {
      const siteInfo = blockingEngine.getSiteInfo('https://music.youtube.com/watch?v=abc123');
      expect(siteInfo).toEqual({
        hostname: 'music.youtube.com',
        pathname: '/watch',
        url: 'https://music.youtube.com/watch?v=abc123'
      });
    });

    test('should return null for invalid URL', () => {
      const siteInfo = blockingEngine.getSiteInfo('invalid-url');
      expect(siteInfo).toBeNull();
    });
  });

  describe('findMatchingWhitelistEntry', () => {
    test('should find path-specific match', () => {
      const match = blockingEngine.findMatchingWhitelistEntry(
        ['music.youtube.com/watch', 'facebook.com'],
        'https://music.youtube.com/watch?v=123'
      );
      expect(match).toBe('music.youtube.com/watch');
    });

    test('should find domain-only match', () => {
      const match = blockingEngine.findMatchingWhitelistEntry(
        ['music.youtube.com', 'facebook.com'],
        'https://music.youtube.com/playlist'
      );
      expect(match).toBe('music.youtube.com');
    });

    test('should return null when no match', () => {
      const match = blockingEngine.findMatchingWhitelistEntry(
        ['facebook.com'],
        'https://music.youtube.com/watch'
      );
      expect(match).toBeNull();
    });
  });

  describe('checkIfUrlWouldBeBlocked', () => {
    test('should return true for blocked domain', () => {
      const wouldBeBlocked = blockingEngine.checkIfUrlWouldBeBlocked(
        ['youtube.com', 'facebook.com'],
        'https://www.youtube.com/watch?v=123'
      );
      expect(wouldBeBlocked).toBe(true);
    });

    test('should return false for non-blocked domain', () => {
      const wouldBeBlocked = blockingEngine.checkIfUrlWouldBeBlocked(
        ['facebook.com'],
        'https://www.youtube.com/watch?v=123'
      );
      expect(wouldBeBlocked).toBe(false);
    });

    test('should handle subdomain matching', () => {
      const wouldBeBlocked = blockingEngine.checkIfUrlWouldBeBlocked(
        ['youtube.com'],
        'https://music.youtube.com/watch'
      );
      expect(wouldBeBlocked).toBe(true);
    });

    test('should return true for path-based blocks', () => {
      const wouldBeBlocked = blockingEngine.checkIfUrlWouldBeBlocked(
        ['github.com/odnetnin164'],
        'https://github.com/odnetnin164/pomoblock'
      );
      expect(wouldBeBlocked).toBe(true);
    });

    test('should return false for non-matching path-based blocks', () => {
      const wouldBeBlocked = blockingEngine.checkIfUrlWouldBeBlocked(
        ['github.com/someotheruser'],
        'https://github.com/odnetnin164/pomoblock'
      );
      expect(wouldBeBlocked).toBe(false);
    });
  });

  describe('checkIfUrlIsWhitelisted', () => {
    test('should return true for whitelisted URL', () => {
      const isWhitelisted = blockingEngine.checkIfUrlIsWhitelisted(
        ['music.youtube.com/watch'],
        'https://music.youtube.com/watch?v=123'
      );
      expect(isWhitelisted).toBe(true);
    });

    test('should return false for non-whitelisted URL', () => {
      const isWhitelisted = blockingEngine.checkIfUrlIsWhitelisted(
        ['facebook.com'],
        'https://music.youtube.com/watch'
      );
      expect(isWhitelisted).toBe(false);
    });
  });
});

