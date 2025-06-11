import { 
  generateBlockOptions, 
  generateSubdomainWhitelistOptions,
  normalizeURL,
  cleanURL,
  isValidDomain
} from '../src/shared/urlUtils';
import { BlockOption, BlockType } from '../src/shared/types';

describe('URL Utils - Block Options', () => {
  describe('generateBlockOptions', () => {
    test('should generate options for YouTube subdomain', () => {
      const url = 'https://music.youtube.com/watch?v=abc123';
      const options = generateBlockOptions(url);
      
      expect(options).toHaveLength(4);
      
      // Domain option
      expect(options[0]).toEqual({
        type: 'domain',
        label: 'Entire youtube.com domain',
        target: 'youtube.com',
        description: 'Blocks youtube.com and all its subdomains'
      });
      
      // Subdomain option
      expect(options[1]).toEqual({
        type: 'subdomain',
        label: 'music.youtube.com subdomain only',
        target: 'music.youtube.com',
        description: 'Blocks only music.youtube.com, not other subdomains'
      });
      
      // Path option
      expect(options[2]).toEqual({
        type: 'path',
        label: 'music.youtube.com/watch path',
        target: 'music.youtube.com/watch',
        description: 'Blocks only this section of the site'
      });
      
      // Page option
      expect(options[3]).toEqual({
        type: 'page',
        label: 'This specific page',
        target: 'music.youtube.com/watch',
        description: 'Blocks only this exact page'
      });
    });

    test('should generate options for Reddit subreddit', () => {
      const url = 'https://www.reddit.com/r/programming/hot/';
      const options = generateBlockOptions(url);
      
      expect(options).toHaveLength(3); // No subdomain option for reddit.com
      
      // Domain option
      expect(options[0]).toEqual({
        type: 'domain',
        label: 'Entire reddit.com domain',
        target: 'reddit.com',
        description: 'Blocks reddit.com and all its subdomains'
      });
      
      // Path option
      expect(options[1]).toEqual({
        type: 'path',
        label: 'reddit.com/r/programming/hot path',
        target: 'reddit.com/r/programming/hot',
        description: 'Blocks only this section of the site'
      });
    });

    test('should generate options for simple domain', () => {
      const url = 'https://example.com/';
      const options = generateBlockOptions(url);
      
      expect(options).toHaveLength(1); // Only domain option for root page
      
      expect(options[0]).toEqual({
        type: 'domain',
        label: 'Entire example.com domain',
        target: 'example.com',
        description: 'Blocks example.com and all its subdomains'
      });
    });

    test('should handle complex subdomain with path', () => {
      const url = 'https://api.docs.example.com/v1/users';
      const options = generateBlockOptions(url);
      
      expect(options).toHaveLength(4);
      
      // Should extract main domain as example.com
      expect(options[0].target).toBe('example.com');
      expect(options[1].target).toBe('api.docs.example.com');
      expect(options[2].target).toBe('api.docs.example.com/v1/users');
    });

    test('should handle invalid URLs gracefully', () => {
      const url = 'invalid-url';
      const options = generateBlockOptions(url);
      
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        type: 'domain',
        label: 'Invalid URL',
        target: '',
        description: 'Cannot parse this URL'
      });
    });
  });

  describe('generateSubdomainWhitelistOptions', () => {
    test('should generate whitelist option when main domain is blocked', () => {
      const url = 'https://music.youtube.com/watch?v=abc123';
      const blockedDomains = ['youtube.com', 'facebook.com'];
      
      const options = generateSubdomainWhitelistOptions(url, blockedDomains);
      
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        type: 'subdomain',
        label: 'Whitelist music.youtube.com',
        target: 'music.youtube.com',
        description: 'Allow music.youtube.com while keeping youtube.com blocked'
      });
    });

    test('should return empty array when main domain is not blocked', () => {
      const url = 'https://music.youtube.com/watch?v=abc123';
      const blockedDomains = ['facebook.com', 'twitter.com'];
      
      const options = generateSubdomainWhitelistOptions(url, blockedDomains);
      
      expect(options).toHaveLength(0);
    });

    test('should return empty array for non-subdomain URLs', () => {
      const url = 'https://example.com/';
      const blockedDomains = ['example.com'];
      
      const options = generateSubdomainWhitelistOptions(url, blockedDomains);
      
      expect(options).toHaveLength(0);
    });

    test('should handle case insensitive domain matching', () => {
      const url = 'https://Music.YouTube.com/watch?v=abc123';
      const blockedDomains = ['youtube.com'];
      
      const options = generateSubdomainWhitelistOptions(url, blockedDomains);
      
      expect(options).toHaveLength(1);
      expect(options[0].target).toBe('music.youtube.com');
    });
  });

  describe('Helper functions', () => {
    test('normalizeURL should remove www prefix', () => {
      expect(normalizeURL('www.example.com')).toBe('example.com');
      expect(normalizeURL('example.com')).toBe('example.com');
      expect(normalizeURL('WWW.EXAMPLE.COM')).toBe('EXAMPLE.COM');
    });

    test('cleanURL should clean various URL formats', () => {
      expect(cleanURL('https://www.example.com/path?query=1#hash')).toBe('example.com/path');
      expect(cleanURL('http://example.com:8080/path')).toBe('example.com');
      expect(cleanURL('example.com')).toBe('example.com');
    });

    test('isValidDomain should validate domain formats', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('example.com/path')).toBe(true);
      expect(isValidDomain('invalid')).toBe(false);
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain('just-text')).toBe(false);
    });
  });
});