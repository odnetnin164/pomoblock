import { normalizeURL } from '@shared/urlUtils';
import { logger } from '@shared/logger';
import { SiteToggleState } from '@shared/types';

export class BlockingEngine {
  private restrictedSites = new Set<string>();
  private whitelistedPaths = new Set<string>();
  private blockedSitesToggleState: SiteToggleState = {};
  private whitelistedPathsToggleState: SiteToggleState = {};

  constructor() {
    this.restrictedSites = new Set();
    this.whitelistedPaths = new Set();
    this.blockedSitesToggleState = {};
    this.whitelistedPathsToggleState = {};
  }

  /**
   * Update the blocked sites list
   */
  updateBlockedSites(sites: string[]): void {
    this.restrictedSites.clear();
    sites.forEach(site => {
      this.restrictedSites.add(site.toLowerCase());
    });
    logger.log('Updated blocked sites', Array.from(this.restrictedSites));
  }

  /**
   * Update the whitelisted paths list
   */
  updateWhitelistedPaths(paths: string[]): void {
    this.whitelistedPaths.clear();
    paths.forEach(path => {
      this.whitelistedPaths.add(path.toLowerCase());
    });
    logger.log('Updated whitelisted paths', Array.from(this.whitelistedPaths));
  }

  /**
   * Update blocked sites toggle state
   */
  updateBlockedSitesToggleState(toggleState: SiteToggleState): void {
    this.blockedSitesToggleState = { ...toggleState };
    logger.log('Updated blocked sites toggle state', this.blockedSitesToggleState);
  }

  /**
   * Update whitelisted paths toggle state
   */
  updateWhitelistedPathsToggleState(toggleState: SiteToggleState): void {
    this.whitelistedPathsToggleState = { ...toggleState };
    logger.log('Updated whitelisted paths toggle state', this.whitelistedPathsToggleState);
  }

  /**
   * Check if a blocked site is enabled
   */
  private isBlockedSiteEnabled(site: string): boolean {
    return this.blockedSitesToggleState[site] ?? true; // Default to enabled
  }

  /**
   * Check if a whitelisted path is enabled
   */
  private isWhitelistedPathEnabled(path: string): boolean {
    return this.whitelistedPathsToggleState[path] ?? true; // Default to enabled
  }

  /**
   * Check if current URL matches any whitelisted path
   */
  isWhitelistedPath(): boolean {
    const currentUrl = window.location.href;
    const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
    const currentPathname = window.location.pathname.toLowerCase();
    
    logger.log('Checking whitelisted paths for', { currentHostname, currentPathname });
    
    for (const whitelistedPath of this.whitelistedPaths) {
      logger.log('Checking against whitelisted path', whitelistedPath);
      
      if (whitelistedPath.includes('/')) {
        // This is a path-specific whitelist entry
        const [pathDomain, ...pathParts] = whitelistedPath.split('/');
        const pathPath = ('/' + pathParts.join('/')).toLowerCase();
        const normalizedPathDomain = normalizeURL(pathDomain.toLowerCase());
        
        logger.log('Path-based whitelist check', { 
          pathDomain: normalizedPathDomain, 
          pathPath, 
          currentHostname, 
          currentPathname 
        });
        
        // Check if domain matches and current path starts with whitelisted path
        if (currentHostname === normalizedPathDomain && currentPathname.startsWith(pathPath)) {
          if (this.isWhitelistedPathEnabled(whitelistedPath)) {
            logger.log('WHITELIST PATH MATCH FOUND (ENABLED)', { whitelistedPath, currentHostname, currentPathname });
            return true;
          } else {
            logger.log('WHITELIST PATH MATCH FOUND BUT DISABLED', { whitelistedPath, currentHostname, currentPathname });
          }
        }
      } else {
        // This is a domain-only whitelist entry
        const normalizedDomain = normalizeURL(whitelistedPath.toLowerCase());
        
        // Exact domain match (for subdomains in whitelist)
        if (currentHostname === normalizedDomain) {
          if (this.isWhitelistedPathEnabled(whitelistedPath)) {
            logger.log('WHITELIST EXACT DOMAIN MATCH FOUND (ENABLED)', { currentHostname, whitelistedPath: normalizedDomain });
            return true;
          } else {
            logger.log('WHITELIST EXACT DOMAIN MATCH FOUND BUT DISABLED', { currentHostname, whitelistedPath: normalizedDomain });
          }
        }
        
        // NOTE: We DO NOT do subdomain matching for whitelisted entries
        // If user wants to whitelist music.youtube.com, they whitelist exactly that
        // This prevents youtube.com whitelist from affecting gaming.youtube.com
      }
    }
    
    logger.log('No whitelist match found');
    return false;
  }

  /**
   * Pause all media elements on the page
   */
  private pauseAllMedia(): void {
    try {
      // Pause HTML5 video and audio elements
      const mediaElements = document.querySelectorAll('video, audio') as NodeListOf<HTMLMediaElement>;
      mediaElements.forEach(element => {
        if (!element.paused) {
          element.pause();
          logger.log('Paused media element:', { tagName: element.tagName, src: element.src || element.currentSrc });
        }
      });

      // Handle YouTube-specific elements
      if (window.location.hostname.includes('youtube.com')) {
        // Try to pause YouTube player via postMessage API
        const ytIframes = document.querySelectorAll('iframe[src*="youtube.com"]') as NodeListOf<HTMLIFrameElement>;
        ytIframes.forEach(iframe => {
          try {
            iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            logger.log('Sent pause command to YouTube iframe');
          } catch (e) {
            logger.log('Could not pause YouTube iframe:', e);
          }
        });

        // Try to pause main YouTube player
        try {
          // Look for YouTube's video player
          const ytPlayer = document.querySelector('#movie_player, .html5-video-player') as any;
          if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
            ytPlayer.pauseVideo();
            logger.log('Paused YouTube player via API');
          }
        } catch (e) {
          logger.log('Could not pause YouTube player via API:', e);
        }
      }

      // Handle common video players
      const videoPlayers = document.querySelectorAll('[data-testid*="player"], .video-player, .player, .video-container video');
      videoPlayers.forEach(player => {
        const video = player.tagName === 'VIDEO' ? player as HTMLVideoElement : player.querySelector('video') as HTMLVideoElement;
        if (video && !video.paused) {
          video.pause();
          logger.log('Paused video in player container');
        }
      });

      // Try to click pause buttons as a fallback
      const pauseButtons = document.querySelectorAll(
        '[aria-label*="pause" i], [aria-label*="Play" i], [title*="pause" i], [title*="Play" i], ' +
        '.pause-button, .play-button, .video-pause, .video-play, ' +
        'button[data-testid*="pause"], button[data-testid*="play"]'
      );
      
      pauseButtons.forEach(button => {
        const btn = button as HTMLElement;
        // Only click if it looks like a pause button (not play)
        const isPauseButton = btn.getAttribute('aria-label')?.toLowerCase().includes('pause') ||
                             btn.getAttribute('title')?.toLowerCase().includes('pause') ||
                             btn.className.includes('pause');
        
        if (isPauseButton && btn.offsetParent !== null) { // Check if button is visible
          try {
            btn.click();
            logger.log('Clicked pause button:', btn);
          } catch (e) {
            logger.log('Could not click pause button:', e);
          }
        }
      });

      logger.log('Media pause attempt completed');
    } catch (error) {
      logger.log('Error pausing media:', error);
    }
  }

  /**
   * Check if the current website should be blocked
   */
  shouldBlockWebsite(): boolean {
    const currentUrl = window.location.href;
    const currentHostname = normalizeURL(window.location.hostname.toLowerCase());
    const currentPathname = window.location.pathname.toLowerCase();
    
    logger.log('Checking URL', currentUrl);
    logger.log('Hostname', currentHostname);
    logger.log('Pathname', currentPathname);
    logger.log('Against restricted sites', Array.from(this.restrictedSites));
    
    // First check if this path is whitelisted
    if (this.isWhitelistedPath()) {
      logger.log('Site is whitelisted, not blocking');
      return false;
    }
    
    let shouldBlock = false;
    
    // Check each blocked site
    for (const site of this.restrictedSites) {
      logger.log('Comparing with', site);
      
      // Handle path-based blocking (like Reddit subreddits, YouTube channels)
      if (site.includes('/')) {
        const [siteDomain, ...pathParts] = site.split('/');
        const sitePath = ('/' + pathParts.join('/')).toLowerCase();
        const normalizedSiteDomain = normalizeURL(siteDomain.toLowerCase());
        
        logger.log('Path-based check', { siteDomain: normalizedSiteDomain, sitePath, currentHostname, currentPathname });
        
        // Check if domain matches and path starts with the blocked path
        if (currentHostname === normalizedSiteDomain && currentPathname.startsWith(sitePath)) {
          if (this.isBlockedSiteEnabled(site)) {
            logger.log('PATH MATCH FOUND (ENABLED)', { site, currentHostname, currentPathname });
            shouldBlock = true;
            break;
          } else {
            logger.log('PATH MATCH FOUND BUT DISABLED', { site, currentHostname, currentPathname });
          }
        }
      } else {
        // Handle domain-based blocking
        const normalizedSite = normalizeURL(site.toLowerCase());
        
        // Exact domain match
        if (currentHostname === normalizedSite) {
          if (this.isBlockedSiteEnabled(site)) {
            logger.log('EXACT DOMAIN MATCH FOUND (ENABLED)', { currentHostname, matchedSite: normalizedSite });
            shouldBlock = true;
            break;
          } else {
            logger.log('EXACT DOMAIN MATCH FOUND BUT DISABLED', { currentHostname, matchedSite: normalizedSite });
          }
        }
        
        // Subdomain match (e.g., blocking "google.com" should block "mail.google.com")
        // BUT NOT if the specific subdomain is whitelisted
        if (currentHostname.endsWith('.' + normalizedSite)) {
          // Check if this specific subdomain is whitelisted
          if (!this.isSubdomainWhitelisted(currentHostname)) {
            if (this.isBlockedSiteEnabled(site)) {
              logger.log('SUBDOMAIN MATCH FOUND (ENABLED)', { currentHostname, matchedSite: normalizedSite });
              shouldBlock = true;
              break;
            } else {
              logger.log('SUBDOMAIN MATCH FOUND BUT DISABLED', { currentHostname, matchedSite: normalizedSite });
            }
          } else {
            logger.log('SUBDOMAIN BLOCKED BUT WHITELISTED', { currentHostname, matchedSite: normalizedSite });
          }
        }
        
        // Partial match for complex domains
        if (currentHostname.includes(normalizedSite)) {
          if (this.isBlockedSiteEnabled(site)) {
            logger.log('PARTIAL MATCH FOUND (ENABLED)', { currentHostname, matchedSite: normalizedSite });
            shouldBlock = true;
            break;
          } else {
            logger.log('PARTIAL MATCH FOUND BUT DISABLED', { currentHostname, matchedSite: normalizedSite });
          }
        }
      }
    }
    
    // If we're blocking this site, pause any playing media
    if (shouldBlock) {
      this.pauseAllMedia();
    }
    
    if (!shouldBlock) {
      logger.log('No match found');
    }
    
    return shouldBlock;
  }

  /**
   * Check if a specific subdomain is whitelisted
   */
  private isSubdomainWhitelisted(hostname: string): boolean {
    const normalizedHostname = normalizeURL(hostname.toLowerCase());
    
    for (const whitelistedPath of this.whitelistedPaths) {
      if (!whitelistedPath.includes('/')) {
        const normalizedWhitelisted = normalizeURL(whitelistedPath.toLowerCase());
        if (normalizedHostname === normalizedWhitelisted) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get current site information for display
   */
  getCurrentSiteInfo(): { hostname: string; pathname: string; url: string } {
    return {
      hostname: normalizeURL(window.location.hostname.toLowerCase()),
      pathname: window.location.pathname.toLowerCase(),
      url: window.location.href
    };
  }
}