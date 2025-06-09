export class StatusDisplay {
  private statusElement: HTMLElement;
  private siteCountElement: HTMLElement;

  constructor(statusElementId: string, siteCountElementId: string) {
    this.statusElement = document.getElementById(statusElementId)!;
    this.siteCountElement = document.getElementById(siteCountElementId)!;
  }

  /**
   * Update the blocked sites count display
   */
  updateSiteCount(blockedCount: number, whitelistedCount: number = 0): void {
    this.siteCountElement.textContent = blockedCount.toString();
    
    if (whitelistedCount > 0) {
      this.statusElement.innerHTML = `
        <span id="siteCount">${blockedCount}</span> sites blocked<br>
        <small>${whitelistedCount} paths whitelisted</small>
      `;
    } else {
      this.statusElement.innerHTML = `
        <span id="siteCount">${blockedCount}</span> sites blocked
      `;
    }
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    this.statusElement.classList.add('loading');
  }

  /**
   * Hide loading state
   */
  hideLoading(): void {
    this.statusElement.classList.remove('loading');
  }
}