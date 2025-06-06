# 🚫 PomoBlock - Modular Chrome Extension

A powerful Chrome extension that helps you stay focused by blocking distracting websites. Built with a modern, modular architecture using webpack for efficient bundling and organization.

## ✨ Features

### 🔒 Advanced Website Blocking
- **Flexible Blocking**: Block specific websites, subdomains, or even specific paths
- **Smart Redirects**: Automatically redirect blocked sites to productive pages
- **Whitelist Support**: Create exceptions for specific paths within blocked domains
- **Pattern Matching**: Support for complex URL patterns and site-specific rules

### ⚙️ User-Friendly Interface
- **Popup Interface**: Quick controls for blocking current page
- **Advanced Options**: Comprehensive configuration page
- **Real-Time Updates**: Instant feedback and status indicators
- **Visual Debug Mode**: Optional debug overlay for troubleshooting

## 🏗️ Architecture

This extension is built with a modern, modular architecture:

### 📁 Project Structure

```
src/
├── content/                    # Content script modules
│   ├── content-main.js        # Main content script entry point
│   ├── blocker.js             # Core blocking logic
│   ├── whitelist-checker.js   # Whitelist validation
│   └── ui/                    # UI components
│       ├── blocked-page.js    # Blocked page generation
│       └── debug-overlay.js   # Debug UI components
├── popup/                     # Popup interface modules
│   ├── popup-main.js          # Main popup entry point
│   ├── site-analyzer.js       # Site analysis utilities
│   ├── actions.js             # User actions (block/whitelist)
│   ├── popup.html             # Popup HTML
│   └── popup.css              # Popup styles
├── options/                   # Options page modules
│   ├── options-main.js        # Main options entry point
│   ├── settings-manager.js    # Settings management
│   ├── site-manager.js        # Blocked sites management
│   ├── whitelist-manager.js   # Whitelist management
│   ├── ui-manager.js          # UI interactions
│   ├── options.html           # Options page HTML
│   └── options.css            # Options page styles
├── shared/                    # Shared utilities and components
│   ├── utils/                 # Utility functions
│   │   ├── url-utils.js       # URL processing utilities
│   │   ├── site-detection.js  # Site type detection
│   │   ├── storage.js         # Chrome storage wrapper
│   │   └── debug.js           # Debug utilities
│   ├── constants/             # Constants and enums
│   │   └── sites.js           # Site-specific patterns
│   └── config/                # Configuration
│       └── defaults.js        # Default settings
└── manifest.json              # Extension manifest
```

### 🔧 Build System

- **Webpack**: Module bundling and optimization
- **Babel**: ES6+ transpilation for browser compatibility
- **CSS Loader**: Style processing and optimization
- **Copy Plugin**: Asset management

## 🚀 Development Setup

### Prerequisites

- Node.js 16+ and npm
- Chrome browser for testing

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd pomoblock-extension
   npm install
   ```

2. **Build the extension**
   ```bash
   # Development build with watching
   npm run dev
   
   # Production build
   npm run build
   ```

3. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder
   - The extension will appear in your toolbar

### Development Commands

```bash
# Install dependencies
npm install

# Development build with file watching
npm run dev

# Production build (minified and optimized)
npm run build

# Clean build directory
npm run clean
```

## 📖 Usage Guide

### Quick Start

1. **Click the extension icon** in your browser toolbar
2. **View current page info** and blocking status
3. **Click "Block This Page"** to add the current site to your block list
4. **Access advanced options** via the "⚙️ Options" button

### Advanced Configuration

1. **Open Options Page**
   - Click the extension icon → "⚙️ Options"
   - Or right-click extension icon → "Options"

2. **Manage Blocked Sites**
   - Add domains: `facebook.com`, `twitter.com`
   - Add specific paths: `reddit.com/r/funny`
   - Add subdomains: `mail.google.com`

3. **Configure Whitelist**
   - Allow specific paths within blocked domains
   - Example: Block `reddit.com` but allow `reddit.com/r/programming`

4. **Set Block Behavior**
   - **Block Mode**: Show custom blocked page
   - **Redirect Mode**: Automatically redirect to specified URL

## 🔧 Technical Details

### Module System

The extension uses ES6 modules with webpack bundling:

- **Shared utilities** are imported across different parts of the extension
- **No code duplication** - common functions are centralized
- **Tree shaking** eliminates unused code in production builds
- **Hot reloading** during development for faster iteration

### Storage Management

Centralized storage utilities with error handling:

```javascript
import { getBlockedWebsites, addBlockedWebsite } from '../shared/utils/storage.js';

// Add a site to block list
await addBlockedWebsite('example.com');

// Get all blocked sites
const sites = await getBlockedWebsites();
```

### URL Processing

Smart URL analysis and pattern matching:

```javascript
import { determineBlockTarget, cleanURL } from '../shared/utils/url-utils.js';

// Determine what should be blocked for current URL
const target = determineBlockTarget(hostname, pathname);
// Returns: 'reddit.com/r/funny' or 'youtube.com' etc.
```

### Debug System

Optional debug overlay for troubleshooting:

```javascript
import { debugLog, initDebug } from '../shared/utils/debug.js';

// Enable debug mode
initDebug(true);

// Log debug information
debugLog('Site blocked', { url, reason });
```

## 🎯 Advanced Features

### Site-Specific Handling

The extension intelligently handles popular sites:

- **Reddit**: Can block specific subreddits (`reddit.com/r/gaming`)
- **YouTube**: Can block specific channels (`youtube.com/channel/UC...`)
- **Twitter**: Can block specific users (`twitter.com/username`)

### Whitelist Priority System

Whitelist rules take priority over block rules:

1. **Path-specific whitelist**: `reddit.com/r/programming`
2. **Subdomain whitelist**: `docs.google.com`
3. **Domain whitelist**: `google.com`

### Flexible Redirect System

- **Instant redirects** (0 second delay)
- **Countdown redirects** (1-30 second delay with cancellation option)
- **Fallback handling** for failed redirects
- **URL validation** and security checks

## 🐛 Debugging

### Debug Mode

Enable debug mode in options to see:
- Real-time blocking decisions
- URL pattern matching
- Storage operations
- Error messages

### Console Logging

All modules use consistent logging:
```
[PomoBlock Debug] Site blocked: reddit.com/r/funny
[PomoBlock Error] Failed to save settings: Storage quota exceeded
```

### Common Issues

1. **Sites not blocking**: Check debug mode to see matching logic
2. **Settings not saving**: Verify Chrome storage permissions
3. **Whitelist not working**: Ensure path format is correct

## 🤝 Contributing

### Code Organization

- Keep modules focused on single responsibilities
- Use shared utilities to avoid duplication
- Add JSDoc comments for public functions
- Follow existing naming conventions

### Adding New Features

1. Create new modules in appropriate directories
2. Import shared utilities instead of duplicating code
3. Update webpack entry points if needed
4. Test across different browsers and scenarios

### Build Process

The build process:
1. Transpiles ES6+ code with Babel
2. Bundles modules with webpack
3. Copies static assets (HTML, CSS, icons)
4. Generates source maps for debugging
5. Optimizes for production (minification, tree shaking)

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with modern ES6+ modules and webpack
- Uses Chrome Extension Manifest V3
- Designed for optimal performance and maintainability

---

**Stay focused! 🎯** This modular architecture makes the extension easier to maintain, extend, and debug while providing powerful website blocking capabilities.