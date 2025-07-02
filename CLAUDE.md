# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` - Production build using webpack
- `npm run dev` - Development build with watch mode
- `npm run clean` - Remove dist directory

## Testing Commands

- `npm test` - Run Jest test suite
- `npm test -- <test-file>` - Run specific test file (e.g., `npm test -- blockedPage.test.ts`)
- `npm test -- --testNamePattern="pattern"` - Run tests matching a specific pattern
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Project Architecture

This is a Chrome Extension (Manifest V3) that combines website blocking with a Pomodoro timer. The extension has five main entry points defined in webpack.config.js:

### Core Components

1. **Background Service Worker** (`src/background/`)
   - `BackgroundPomodoroManager.ts` - Manages timer state, badge updates, and notifications
   - Handles persistent timer logic and cross-extension communication

2. **Content Script** (`src/contentScript/`)
   - `blockingEngine.ts` - Handles URL matching and site blocking logic
   - `ui/blockedPage.ts` - Creates blocking overlay when sites are restricted (uses Shadow DOM)
   - `ui/floatingTimer.ts` - Shows timer overlay on pages during sessions (uses Shadow DOM)

3. **Popup Interface** (`src/popup/`)
   - Quick timer controls and site management
   - Components: `PomodoroControl.ts`, `SiteManager.ts`, `StatusDisplay.ts`

4. **Options Page** (`src/options/`)
   - Comprehensive settings interface
   - Managers: `PomodoroSettingsManager.ts`, `SettingsManager.ts`, `SiteListManager.ts`

5. **History Page** (`src/history/`)
   - Session tracking and statistics display

### Shared Modules (`src/shared/`)

- `pomodoroTimer.ts` - Core timer logic and state management
- `pomodoroTypes.ts` - TypeScript types for timer functionality
- `pomodoroStorage.ts` - Timer-specific storage operations
- `types.ts` - Main extension types and interfaces
- `storage.ts` - General Chrome storage utilities
- `urlUtils.ts` - URL normalization and matching logic
- `workHoursUtils.ts` - Work hours scheduling functionality
- `logger.ts` - Centralized logging system

### Key Data Flow

1. **Timer State**: BackgroundPomodoroManager → PomodoroTimer → Storage
2. **Site Blocking**: Storage → ContentScript BlockingEngine → Page Blocking
3. **UI Updates**: Background → Popup/Options via message passing
4. **Session Data**: PomodoroTimer → PomodoroStorage → History display

### Path Aliases

Webpack is configured with these path aliases:
- `@shared` → `src/shared`
- `@popup` → `src/popup`
- `@options` → `src/options`
- `@contentScript` → `src/contentScript`
- `@background` → `src/background`
- `@history` → `src/history`

### Extension Architecture Notes

- Uses Chrome Extension Manifest V3 with service worker background script
- Content script runs on all URLs with `document_start` timing
- Permissions include storage, tabs, activeTab, alarms, notifications, contextMenus
- All code splitting is disabled to ensure each entry point is self-contained
- CSS is extracted into separate files using MiniCssExtractPlugin

### Shadow DOM Architecture

The extension uses Shadow DOM for complete CSS isolation in content script components:

#### BlockedPageUI and FloatingTimer Components
- Both use **closed Shadow DOM** mode (`attachShadow({ mode: 'closed' })`)
- CSS is loaded asynchronously via `fetch()` into the Shadow DOM
- Complete isolation from host page styles - no more CSS conflicts
- Event handling works within Shadow DOM boundaries
- Test infrastructure updated to query Shadow DOM elements

#### CSS Loading Pattern
```typescript
private async loadCSS(): Promise<string> {
  const cssUrl = chrome.runtime.getURL('shared/component.css');
  const response = await fetch(cssUrl);
  return await response.text();
}
```

#### Shadow DOM Testing
- Tests must wait for async CSS loading: `await new Promise(resolve => setTimeout(resolve, 100))`
- Helper functions for Shadow DOM queries: `getShadowRoot()`, `queryShadow()`, `getElementByIdShadow()`
- Elements use `display: flex` instead of `display: block` in Shadow DOM

### Timer States

The Pomodoro timer has these states defined in `pomodoroTypes.ts`:
- `STOPPED` - Timer inactive
- `WORK` - Active work session (sites blocked)
- `REST` - Break period (sites unblocked)  
- `PAUSED` - Timer paused

### Storage Keys

Timer data is stored with `pomodoro` prefix:
- `pomodoroSettings` - User preferences
- `pomodoroTimerStatus` - Current timer state
- `pomodoroDailyStats` - Session statistics
- `pomodoroSessionsHistory` - Historical sessions

### Entry Point Files (`index.ts`)

Each main component has an index.ts file that serves as the entry point:

1. **Background (`src/background/index.ts`)**
   - Initializes BackgroundPomodoroManager on extension startup
   - Sets up storage listeners for immediate blocking config changes
   - Handles context menus, notifications, and alarms
   - Manages extension lifecycle events (install, startup, suspend)

2. **Content Script (`src/contentScript/index.ts`)**
   - Creates ContentScriptManager that orchestrates blocking and timer UI
   - Handles navigation detection (popstate, pushState, focus events)
   - Manages blocking engine, blocked page UI, and floating timer
   - Responds to timer state changes and blocking config updates

3. **Popup (`src/popup/index.ts`)**
   - Imports popup.css and initializes PopupManager
   - Manages site blocking UI, timer controls, and status updates
   - Handles integrated timer blocking states (work/rest modes)
   - Provides quick access to site management and settings

4. **Options (`src/options/index.ts`)**
   - Imports options.css and initializes OptionsPageManager
   - Coordinates three managers: SettingsManager, SiteListManager, PomodoroSettingsManager
   - Handles comprehensive settings, site lists, and work hours configuration
   - Provides UI for editing blocked sites and whitelisted paths

5. **History (`src/history/index.ts`)**
   - Imports history.css and initializes HistoryManager
   - Displays Pomodoro session statistics and history
   - Shows work/rest session completion rates and total focused time
   - Provides data management (clear history functionality)

### CSS Architecture

The extension uses a modular CSS approach with shared and component-specific styles:

#### Shared CSS (`src/shared/`)

1. **`common-ui.css`** - Foundation styles and components
   - CSS custom properties for colors, spacing, and shadows
   - Common typography, layout utilities, and spacing classes
   - Reusable button styles (primary, secondary, danger, warning)
   - Form inputs, toggle switches, and progress elements
   - Status indicators and animations

2. **`blocked-page.css`** - Blocking overlay styles for Shadow DOM
   - Clean Shadow DOM CSS with `:host { all: initial; }` pattern
   - Full-screen overlay with glassmorphism effects
   - Timer integration UI for work/rest period display
   - Responsive design for mobile and desktop

3. **`floating-timer.css`** - Floating timer widget styles for Shadow DOM
   - Draggable timer bar with progress visualization
   - State-specific colors (work: red, rest: green, paused: orange)
   - Compact design with play/pause controls and close button
   - Complete CSS isolation via Shadow DOM

#### Component CSS

Each major component imports its own CSS file:
- `popup.css` - Popup interface styling
- `options.css` - Options page comprehensive styling  
- `history.css` - History page statistics and session display

### Blocking System Architecture

The extension uses a sophisticated URL blocking system centered around the `BlockingEngine` class:

#### Core Components

1. **BlockingEngine (`src/contentScript/blockingEngine.ts`)**
   - Single source of truth for all blocking decisions
   - Maintains blocklist and whitelist data structures
   - Handles toggle states for individual rules

2. **URL Utils (`src/shared/urlUtils.ts`)**
   - `normalizeURL()` - Removes `www.` prefix for consistent matching
   - `cleanURL()` - Comprehensive URL cleaning (protocols, fragments, etc.)
   - Special handling for Reddit, YouTube, Twitter/X patterns

#### Blocking Pattern Types

1. **Domain-Level Blocking**
   - `example.com` blocks the domain and all subdomains
   - `google.com` also blocks `mail.google.com`, `drive.google.com`
   - Uses subdomain inheritance for broader coverage

2. **Path-Based Blocking**
   - `reddit.com/r/gaming` blocks only that specific subreddit
   - `youtube.com/c/channelname` blocks specific YouTube channels
   - `example.com/admin` blocks paths starting with `/admin`

3. **Special Patterns**
   - IP addresses with optional ports: `192.168.1.1:8080`
   - Social media profiles: `twitter.com/username`
   - Excludes system pages like `chrome://` and `/settings`

#### Whitelist System

**Priority**: Whitelists always override blocklists

**Matching Behavior**:
- **No Subdomain Inheritance**: `youtube.com` whitelisted ≠ `music.youtube.com` whitelisted
- **Exact Path Matching**: More precise than blocklist matching
- **Query Parameter Inclusion**: Whitelist matching includes search parameters

**Common Use Cases**:
- `music.youtube.com` - Allow YouTube Music while blocking main YouTube
- `facebook.com/pages` - Allow business pages while blocking main site
- `reddit.com/r/programming` - Allow specific subreddits

#### Blocking Decision Algorithm

```
1. Parse target URL (hostname, pathname)
2. Check whitelist first:
   - If any enabled whitelist pattern matches → ALLOW
3. Check blocklist:
   - For each enabled blocked site pattern:
     - Path-based matching if pattern contains '/'
     - Domain-based matching (with subdomains) if no '/'
     - If match found → BLOCK
4. No matches → ALLOW
```

#### Toggle States

Each rule can be individually enabled/disabled:
- `blockedSitesToggleState` - Per-site blocking enable/disable
- `whitelistedPathsToggleState` - Per-path whitelist enable/disable
- Default state is `true` (enabled) if not explicitly set
- Allows temporary rule deactivation without deletion

#### URL Normalization

All URLs are processed case-insensitively:
- Converted to lowercase before pattern matching
- Removes protocols, `www.` prefixes, and hash fragments
- Maintains original case in storage but uses lowercase for comparisons

## Message Passing Architecture

The extension uses Chrome's message passing for cross-context communication:

### Background ↔ Content Script Communication
- `TIMER_UPDATE` - Background broadcasts timer status changes to all tabs
- `TIMER_COMPLETE` - Sent when Pomodoro sessions end (triggers vibration)
- `TIMER_INITIALIZATION_COMPLETE` - Sent after background service worker initializes
- `PLAY_CUSTOM_AUDIO` - Requests content scripts to play audio (service workers can't use Web Audio API)

### Message Flow Pattern
```typescript
// Background sends to all tabs
this.broadcastMessage({
  type: 'TIMER_UPDATE',
  data: { timerStatus: status }
});

// Content script listens
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TIMER_UPDATE') {
    this.updateStatus(message.data.timerStatus);
  }
});
```

## Audio System Architecture

The extension includes a sophisticated audio system for Pomodoro notifications:

### AudioManager Class (`src/shared/audioManager.ts`)
- Manages Web Audio API contexts and sound loading
- Supports built-in sounds (chime, bell, ding) and custom uploads
- Volume control and theme-based sound selection
- Preloads audio buffers for smooth playback

### Audio Flow
1. **Background Service Worker**: Cannot use Web Audio API directly
2. **Content Scripts**: Receive `PLAY_CUSTOM_AUDIO` messages and handle playback
3. **Settings Storage**: Audio preferences stored with Pomodoro settings
4. **Sound Files**: Located in `/sounds/` directory with theme folders

## Visual Effects System

### Floating Timer Vibration
When Pomodoro sessions complete, the floating timer triggers a visual shake animation:

```typescript
// CSS keyframes are added to Shadow DOM for complete isolation
// Animation applied to .floating-timer element inside Shadow DOM
floatingTimerElement.style.animation = 'shake 0.6s ease-in-out';
```

### Animation Architecture
- Keyframes defined in Shadow DOM for CSS isolation
- Applied to internal elements, not host container
- Cleanup after 600ms animation duration

## Constants and Configuration

Key configuration is centralized in `src/shared/constants.ts`:

### Storage Key Patterns
- **General Extension**: `STORAGE_KEYS.*` (e.g., `blockedWebsitesArray`)
- **Pomodoro System**: `POMODORO_STORAGE_KEYS.*` (e.g., `pomodoroSettings`)
- **Floating Timer**: `floatingTimerSettings` for position and visibility

### Default Settings Hierarchy
```typescript
DEFAULT_SETTINGS → DEFAULT_POMODORO_SETTINGS → DEFAULT_TIMER_STATUS
```

## Test Infrastructure

### Jest Configuration
- **Environment**: jsdom for DOM testing
- **Setup**: Chrome API mocking in `tests/setup.ts`
- **Path Mapping**: Mirrors webpack aliases for consistent imports

### Shadow DOM Testing Patterns
```typescript
// Access closed Shadow DOM in tests via _testShadowRoot
const shadowRoot = (component as any)._testShadowRoot;
const element = shadowRoot?.querySelector('.target-element');

// Wait for async CSS loading in Shadow DOM components
await new Promise(resolve => setTimeout(resolve, 100));
```

### Test Naming Conventions
- **Component Tests**: `ComponentName.test.ts`
- **Integration Tests**: `moduleName.test.ts`
- **Pattern Matching**: Use `--testNamePattern` for focused testing

## Development Workflow

### Chrome Extension Development
- **Hot Reload**: Use `npm run dev` for development builds with watch mode
- **Extension Reload**: Manually reload extension in `chrome://extensions` after changes
- **Debugging**: Check both extension console and page console for content script issues

### Common Development Tasks
- **Build for Production**: `npm run build` (creates optimized `dist/` folder)
- **Run Specific Tests**: `npm test -- componentName.test.ts`
- **Test with Pattern**: `npm test -- --testNamePattern="vibration"`
- **Coverage Report**: `npm run test:coverage`

### Code Splitting Disabled
All entry points are self-contained (no shared chunks) to ensure proper Chrome extension loading.

## Important Implementation Notes

### Timer State Persistence
- Timer state persists across browser restarts via Chrome storage
- Background service worker maintains timer even when popup is closed
- Cross-tab synchronization ensures consistent state across multiple windows

### Performance Considerations
- Shadow DOM provides complete CSS isolation but requires careful event handling
- Content scripts inject into all pages but only activate based on blocking rules
- Background service worker has limited API access (no Web Audio, limited DOM)

### Security and Permissions
- Manifest V3 compliance with service worker architecture
- Minimal permissions: storage, tabs, activeTab, alarms, notifications
- No external network requests except for built-in redirect URLs