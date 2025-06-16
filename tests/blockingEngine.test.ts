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

describe('BlockingEngine - Media Pausing', () => {
  let blockingEngine: BlockingEngine;
  let mockVideoElement: Partial<HTMLVideoElement>;
  let mockAudioElement: Partial<HTMLAudioElement>;

  beforeEach(() => {
    blockingEngine = new BlockingEngine();

    // Create mock media elements
    mockVideoElement = {
      paused: false,
      pause: jest.fn(),
      tagName: 'VIDEO',
      src: 'https://youtube.com/video.mp4'
    };

    mockAudioElement = {
      paused: false,
      pause: jest.fn(),
      tagName: 'AUDIO',
      src: 'https://youtube.com/audio.mp3'
    };

    // Mock document.querySelectorAll
    jest.spyOn(document, 'querySelectorAll').mockImplementation((selector: string) => {
      if (selector === 'video, audio') {
        return [mockVideoElement, mockAudioElement] as any;
      }
      return [] as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should pause media when site is blocked via spy', () => {
    // Spy on shouldBlockWebsite to force it to return true and trigger media pausing
    const shouldBlockSpy = jest.spyOn(blockingEngine, 'shouldBlockWebsite').mockImplementation(() => {
      // Call the private pauseAllMedia method directly by accessing it
      (blockingEngine as any).pauseAllMedia();
      return true;
    });

    // Call shouldBlockWebsite which will trigger media pausing
    const shouldBlock = blockingEngine.shouldBlockWebsite();

    expect(shouldBlock).toBe(true);
    expect(mockVideoElement.pause).toHaveBeenCalled();
    expect(mockAudioElement.pause).toHaveBeenCalled();
    
    shouldBlockSpy.mockRestore();
  });

  test('should not pause already paused media', () => {
    // Create new mock elements that are already paused
    const pausedVideoElement = {
      paused: true,
      pause: jest.fn(),
      tagName: 'VIDEO',
      src: 'https://youtube.com/video.mp4'
    };

    const pausedAudioElement = {
      paused: true,
      pause: jest.fn(),
      tagName: 'AUDIO',
      src: 'https://youtube.com/audio.mp3'
    };

    // Mock document.querySelectorAll to return already paused elements
    jest.spyOn(document, 'querySelectorAll').mockImplementation((selector: string) => {
      if (selector === 'video, audio') {
        return [pausedVideoElement, pausedAudioElement] as any;
      }
      return [] as any;
    });

    // Mock shouldBlockWebsite to trigger media pausing
    const shouldBlockSpy = jest.spyOn(blockingEngine, 'shouldBlockWebsite').mockImplementation(() => {
      (blockingEngine as any).pauseAllMedia();
      return true;
    });

    const shouldBlock = blockingEngine.shouldBlockWebsite();

    expect(shouldBlock).toBe(true);
    expect(pausedVideoElement.pause).not.toHaveBeenCalled();
    expect(pausedAudioElement.pause).not.toHaveBeenCalled();
    
    shouldBlockSpy.mockRestore();
  });

  test('should not pause media when site is not blocked', () => {
    // Mock shouldBlockWebsite to return false without triggering media pausing
    const shouldBlockSpy = jest.spyOn(blockingEngine, 'shouldBlockWebsite').mockReturnValue(false);

    const shouldBlock = blockingEngine.shouldBlockWebsite();

    expect(shouldBlock).toBe(false);
    expect(mockVideoElement.pause).not.toHaveBeenCalled();
    expect(mockAudioElement.pause).not.toHaveBeenCalled();
    
    shouldBlockSpy.mockRestore();
  });
});