# 🚫 Website Blocker & Pomodoro Timer

A powerful Chrome extension that combines website blocking with an integrated pomodoro timer to boost productivity and maintain focus during work sessions.

## ✨ Features

### 🔒 Advanced Website Blocking
- **Blacklist Mode**: Block specific websites you choose
- **Whitelist Mode**: Allow only specific websites (block everything else)
- **Pattern Matching**: Support for subdomains, specific paths, and exact matches
- **Smart Redirects**: Automatically redirect blocked sites to a custom page

### 🍅 Integrated Pomodoro Timer
- **Focused Work Sessions**: 25-minute work periods with automatic site blocking
- **Productive Breaks**: 5-minute breaks with unrestricted browsing
- **Persistent Timer**: Always-visible countdown on extension icon
- **Color-Coded Status**: Red badge for work time, green for breaks
- **Desktop Notifications**: Alerts when switching between work and break periods

### ⚙️ User-Friendly Interface
- **Quick Controls**: Popup interface for instant timer management
- **Advanced Settings**: Comprehensive configuration page
- **Real-Time Updates**: Live timer display and status indicators
- **Customizable Durations**: Adjust work/break times to your preference

## 🚀 Installation

### Method 1: Load Unpacked Extension (Recommended)

1. **Download the extension files**
   - Clone this repository or download the source code
   - Ensure all files are in a single folder

2. **Create extension icons** (optional but recommended)
   - Create simple 16x16, 48x48, and 128x128 pixel icons
   - Name them `icon16.png`, `icon48.png`, and `icon128.png`
   - Place them in the extension folder

3. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" toggle in the top right
   - Click "Load unpacked" button
   - Select your extension folder
   - The extension will appear in your toolbar!

### Method 2: Chrome Web Store
*Coming soon - submit to Chrome Web Store for easier installation*

## 📖 Usage Guide

### Starting Your First Pomodoro Session

1. **Click the extension icon** in your browser toolbar
2. **Add websites to block** using the quick-add input
3. **Choose your blocking mode**:
   - **Blacklist**: Block only the sites you specify
   - **Whitelist**: Block everything except the sites you specify
4. **Click "Start"** to begin your 25-minute work session
5. **Watch the timer** on the extension icon - red badge means sites are blocked

### Managing Your Block Lists

1. **Click the "⚙️ Advanced Settings" button** in the popup
2. **Toggle between modes** using the blacklist/whitelist switch
3. **Add websites** using flexible patterns:
   - `facebook.com` - blocks facebook.com and www.facebook.com
   - `*.reddit.com` - blocks all Reddit subdomains
   - `youtube.com/watch` - blocks only YouTube watch pages
4. **Set custom redirect URL** for blocked sites
5. **Adjust timer durations** to fit your workflow

### Understanding the Timer Display

| Badge Color | Status | Description |
|-------------|---------|-------------|
| 🔴 Red | Work Time | Sites are blocked, focus on work |
| 🟢 Green | Break Time | Sites are unblocked, take a break |
| No Badge | Inactive | Timer stopped, normal browsing |

## 📁 File Structure

```
website-blocker-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (timer logic, blocking rules)
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── options.html           # Settings page
├── options.js             # Settings page functionality
├── rules.json             # Dynamic blocking rules (initially empty)
├── icon16.png             # 16x16 icon (create yourself)
├── icon48.png             # 48x48 icon (create yourself)
└── icon128.png            # 128x128 icon (create yourself)
```

## ⚙️ Configuration Options

### Pomodoro Timer Settings
- **Work Duration**: Default 25 minutes (customizable 1-120 minutes)
- **Short Break**: Default 5 minutes (customizable 1-60 minutes)
- **Long Break**: Default 15 minutes (customizable 1-120 minutes)
- **Sessions Until Long Break**: Default 4 sessions (customizable 1-10)

### Blocking Modes

#### Blacklist Mode (Default)
- Add specific websites to block during work sessions
- All other websites remain accessible
- Perfect for blocking known distractions

#### Whitelist Mode
- Add specific websites that are allowed
- All other websites are blocked during work sessions
- Perfect for extreme focus sessions

### Website Pattern Examples

| Pattern | What It Blocks |
|---------|----------------|
| `facebook.com` | facebook.com, www.facebook.com |
| `*.reddit.com` | reddit.com, www.reddit.com, old.reddit.com, etc. |
| `youtube.com/watch` | Only YouTube video pages |
| `twitter.com` | twitter.com, www.twitter.com |
| `*.social-media.com` | All subdomains of social-media.com |

## 🔧 Technical Details

### Chrome Extension Manifest V3
- Built using modern Manifest V3 architecture
- Uses declarativeNetRequest API for efficient blocking
- Service worker for background timer management
- Secure storage for user preferences

### Permissions Required
- `declarativeNetRequest`: Website blocking functionality
- `storage`: Save user settings and preferences
- `activeTab`: Access current tab information
- `tabs`: Manage tab redirections
- `alarms`: Timer functionality
- `<all_urls>`: Apply blocking rules to all websites

### Browser Compatibility
- Chrome 88+ (Manifest V3 support required)
- Chromium-based browsers (Edge, Brave, etc.)
- Does not work on Firefox (different extension API)

## 🐛 Troubleshooting

### Timer Not Showing on Icon
- Ensure the extension is properly loaded
- Check that you've started the timer from the popup
- Refresh the extension page if needed

### Websites Not Being Blocked
- Verify websites are added to the correct list (blacklist/whitelist)
- Check that the timer is active and in work mode (red badge)
- Make sure website patterns are correct (no http:// prefix)
- Try reloading the target website

### Settings Not Saving
- Check that you clicked "Save Settings" button
- Ensure Chrome has sufficient storage permissions
- Try disabling and re-enabling the extension

### Extension Not Loading
- Verify all files are in the extension folder
- Check Chrome developer console for error messages
- Ensure manifest.json is valid JSON
- Try loading extension in incognito mode

## 🎯 Best Practices

### Effective Website Blocking
1. **Start with common distractions**: Social media, news sites, entertainment
2. **Use specific paths**: Block `youtube.com/watch` instead of all of YouTube
3. **Test your patterns**: Verify blocking works as expected
4. **Regular reviews**: Update your block lists based on new distractions

### Pomodoro Technique Tips
1. **Plan your work**: Decide what to accomplish before starting
2. **Eliminate distractions**: Use the blocker to maintain focus
3. **Take real breaks**: Step away from the computer during breaks
4. **Track progress**: Note what you accomplished each session

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Make your changes
3. Test thoroughly with different websites and patterns
4. Submit a pull request with detailed description

### Reporting Issues
- Check existing issues before creating new ones
- Include Chrome version and extension version
- Provide steps to reproduce the problem
- Include console error messages if applicable

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Inspired by the Pomodoro Technique by Francesco Cirillo
- Built with Chrome Extension Manifest V3
- Uses modern web technologies for optimal performance

## 📞 Support

- **Issues**: Report bugs on GitHub Issues
- **Feature Requests**: Submit via GitHub Issues with "enhancement" label
- **Documentation**: Check this README and inline code comments

---

**Happy focusing! 🎯** Made with ❤️ to help you stay productive and achieve your goals.