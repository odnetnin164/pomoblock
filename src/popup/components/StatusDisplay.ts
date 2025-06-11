export class StatusDisplay {
  private statusElement: HTMLElement | null;
  private siteCountElement: HTMLElement | null;

  constructor(statusElementId: string, siteCountElementId: string) {
    this.statusElement = document.getElementById(statusElementId);
    this.siteCountElement = document.getElementById(siteCountElementId);
    
    if (!this.statusElement) {
      console.error(`StatusDisplay: Element with id '${statusElementId}' not found`);
    }
    if (!this.siteCountElement) {
      console.error(`StatusDisplay: Element with id '${siteCountElementId}' not found`);
    }
  }

  /**
   * Update the blocked sites count display
   */
  updateSiteCount(blockedCount: number, whitelistedCount: number = 0): void {
    if (!this.statusElement) {
      console.error('StatusDisplay: statusElement is null, cannot update site count');
      return;
    }

    if (whitelistedCount > 0) {
      this.statusElement.innerHTML = `
        <span id="siteCount">${blockedCount}</span> blocked<br>
        <small>${whitelistedCount} paths whitelisted</small>
      `;
      // Re-get the siteCount element since we recreated the HTML
      this.siteCountElement = document.getElementById('siteCount');
    } else {
      this.statusElement.innerHTML = `
        <span id="siteCount">${blockedCount}</span> blocked
      `;
      // Re-get the siteCount element since we recreated the HTML
      this.siteCountElement = document.getElementById('siteCount');
    }
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    if (this.statusElement) {
      this.statusElement.classList.add('loading');
    }
  }

  /**
   * Hide loading state
   */
  hideLoading(): void {
    if (this.statusElement) {
      this.statusElement.classList.remove('loading');
    }
  }
}