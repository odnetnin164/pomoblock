import { BlockingEngine } from '../src/contentScript/blockingEngine';

describe('BlockingEngine - Subdomain Whitelisting', () => {
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
    
    // Mock window.location for each test
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
      (window.location as any).hostname = 'gaming.youtube.com';
      
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
      (window.location as any).pathname = '/playlist';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com/watch']);
      
      // music.youtube.com/playlist should be blocked (path doesn't match)
      expect(blockingEngine.shouldBlockWebsite()).toBe(true);
    });

    test('should handle case insensitive matching', () => {
      (window.location as any).hostname = 'Music.YouTube.com';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['music.youtube.com']);
      
      expect(blockingEngine.shouldBlockWebsite()).toBe(false);
    });

    test('should work with complex subdomain hierarchies', () => {
      (window.location as any).hostname = 'api.v2.music.youtube.com';
      
      blockingEngine.updateBlockedSites(['youtube.com']);
      blockingEngine.updateWhitelistedPaths(['api.v2.music.youtube.com']);
      
      expect(blockingEngine.shouldBlockWebsite()).toBe(false);
    });
  });

  describe('isWhitelistedPath', () => {
    test('should match exact domain whitelist', () => {
      (window.location as any).hostname = 'music.youtube.com';
      (window.location as any).pathname = '/';
      
      blockingEngine.updateWhitelistedPaths(['music.youtube.com']);
      
      expect(blockingEngine.isWhitelistedPath()).toBe(true);
    });

    test('should not do subdomain matching for whitelist entries', () => {
      (window.location as any).hostname = 'music.youtube.com';
      
      // Whitelist main domain but current site is subdomain
      blockingEngine.updateWhitelistedPaths(['youtube.com']);
      
      // Should NOT match - we don't want youtube.com whitelist to affect subdomains
      expect(blockingEngine.isWhitelistedPath()).toBe(false);
    });

    test('should match path-specific whitelist', () => {
      (window.location as any).hostname = 'music.youtube.com';
      (window.location as any).pathname = '/watch';
      
      blockingEngine.updateWhitelistedPaths(['music.youtube.com/watch']);
      
      expect(blockingEngine.isWhitelistedPath()).toBe(true);
    });

    test('should match path prefix', () => {
      (window.location as any).hostname = 'music.youtube.com';
      (window.location as any).pathname = '/watch/playlist';
      
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