# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` - Production build using webpack
- `npm run dev` - Development build with watch mode
- `npm run clean` - Remove dist directory

## Project Architecture

This is a Chrome Extension (Manifest V3) that combines website blocking with a Pomodoro timer. The extension has five main entry points defined in webpack.config.js:

### Core Components

1. **Background Service Worker** (`src/background/`)
   - `BackgroundPomodoroManager.ts` - Manages timer state, badge updates, and notifications
   - Handles persistent timer logic and cross-extension communication

2. **Content Script** (`src/contentScript/`)
   - `blockingEngine.ts` - Handles URL matching and site blocking logic
   - `ui/blockedPage.ts` - Creates blocking overlay when sites are restricted
   - `ui/floatingTimer.ts` - Shows timer overlay on pages during sessions

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