# Shadow DOM Logger Implementation

## Overview

The PomoBlock debug logger has been enhanced to use Shadow DOM for complete CSS isolation and improved functionality. This ensures the debug panel remains visible and interactive even when blocking pages with complex CSS or high z-index values.

## Key Features

### 🔒 Shadow DOM Isolation
- Uses Shadow DOM to completely isolate the debug panel from page styles
- Prevents CSS conflicts and ensures consistent appearance
- Remains functional even on heavily styled websites

### 🖱️ Interactive Controls
- **Draggable**: Click and drag the header to move the panel anywhere on screen
- **Resizable**: Use the resize handle in the bottom-right corner to adjust size
- **Clear Logs**: Trash can button to clear all current log entries
- **Close Panel**: X button to hide the debug panel

### 📱 Responsive Design
- Modern glass-morphism design with backdrop blur
- Custom scrollbar styling for better aesthetics
- Automatically scrolls to show newest log entries
- Maintains size and position constraints for usability

### 🎯 High Z-Index Priority
- Uses maximum z-index (2147483647) to appear above all content
- Specifically designed to be visible on top of blocked pages
- Maintains interactivity even when page elements are blocked

## Usage

### Enabling Debug Mode
```typescript
import { logger } from '@shared/logger';

// Enable debug logging
logger.setDebugEnabled(true);

// Add log entries
logger.log('Debug message', { additionalData: 'value' });
```

### In Content Scripts
The logger automatically detects the environment and creates the shadow DOM panel when debug mode is enabled:

```typescript
// The logger will automatically create a movable/resizable panel
logger.log('Site blocked', { url: window.location.href });
logger.log('Timer state changed', { state: 'WORK', duration: 25 });
```

## Implementation Details

### Shadow DOM Structure
```
shadowHost (fixed positioned container)
└── shadowRoot (open shadow root)
    ├── styles (scoped CSS)
    └── debugDiv (main container)
        ├── header (draggable title bar)
        │   ├── title
        │   └── controls (clear, close buttons)
        ├── logContainer (scrollable log area)
        └── resizeHandle (resize grip)
```

### Position & Size Management
- **Default Position**: Top-left (10px, 10px)
- **Default Size**: 320px × 250px
- **Minimum Size**: 250px × 150px
- **Maximum Size**: 600px × 400px
- **Boundary Constraints**: Panel stays within viewport bounds

### Event Handling
- **Drag**: Mouse events on header with boundary checking
- **Resize**: Mouse events on resize handle with size constraints
- **Clear**: Removes all log entries from display and internal storage
- **Close**: Disables debug mode and removes panel

## Browser Compatibility

The shadow DOM logger works in all modern browsers that support:
- Shadow DOM v1 (Chrome 53+, Firefox 63+, Safari 10+)
- CSS backdrop-filter (Chrome 76+, Firefox 70+, Safari 9+)

## Service Worker Detection

The logger automatically detects service worker environments and gracefully degrades:
- Service workers: Logs only to console (no DOM manipulation)
- Content scripts/popup: Full shadow DOM functionality

## CSS Isolation Benefits

1. **No Style Conflicts**: Page CSS cannot affect the debug panel
2. **Consistent Appearance**: Panel looks the same on every website
3. **Performance**: Scoped styles don't impact page rendering
4. **Security**: Isolated from page scripts and styles

## Testing

A test page is available at `tests/test-logger.html` that demonstrates:
- Shadow DOM panel creation
- Drag and resize functionality
- Log entry display
- Interaction with simulated blocked page overlay

## Migration Notes

### Changes from Previous Version
- Moved from regular DOM to Shadow DOM
- Added drag and resize functionality
- Improved visual design and user experience
- Enhanced CSS isolation and conflict prevention
- Updated z-index management for better visibility

### Backward Compatibility
- All existing logger API methods remain unchanged
- Service worker environments continue to work as before
- No changes required to existing logger usage code
