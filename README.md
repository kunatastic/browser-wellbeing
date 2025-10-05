# Browser Digital Wellbeing Extension

A Chrome extension that tracks your website usage and displays time spent on each domain to help you understand your digital habits.

## Features

- **Real-time Tracking**: Automatically tracks time spent on websites
- **Domain-based Analytics**: Groups time by domain (e.g., all GitHub pages as "github.com")
- **Today's View**: Shows consolidated usage for the current day
- **Tab Switch Detection**: Handles switching between tabs and windows
- **Local Storage**: All data stored locally in your browser
- **Modern UI**: Clean, responsive popup interface

## Installation

### Development Setup

1. **Clone or download** this repository to your local machine

2. **Open Chrome Extensions page**:

   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the extension**:

   - Click "Load unpacked"
   - Select the `browser-wellbeing` folder
   - The extension should appear in your extensions list

4. **Pin the extension** (optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Browser Digital Wellbeing" and click the pin icon

## Usage

### How It Works

1. **Automatic Tracking**: The extension starts tracking as soon as you visit any website
2. **View Statistics**: Click the extension icon to see your usage data
3. **Real-time Updates**: Data updates automatically as you browse

### Understanding the Data

- **Total Time**: Shows your total browsing time for today
- **Domain List**: Displays time spent on each website domain
- **Progress Bars**: Visual representation of time distribution
- **Session Count**: Number of visits to each domain

### Data Storage

- All data is stored locally in your browser using Chrome's storage API
- No data is sent to external servers
- Data persists between browser sessions

## File Structure

```
browser-wellbeing/
├── manifest.json          # Extension configuration
├── background.js          # Core tracking logic
├── hello.html            # Popup interface
├── popup.js              # Data processing and display
├── styles.css            # UI styling
├── hello_extensions.png  # Extension icon
└── README.md            # This file
```

## Technical Details

### Data Schema

The extension stores session data in the following format:

```javascript
{
  "sessions": [
    {
      "url": "https://github.com/user/repo",
      "start_time": 1696521600000,  // timestamp in milliseconds
      "end_time": 1696525200000,
      "favicon": "https://github.com/favicon.ico"
    }
  ]
}
```

### Tracking Events

The extension tracks:

- **Tab switches**: When you move between different tabs
- **URL changes**: When you navigate within a tab
- **Window focus**: When you switch between browser and other applications
- **Browser startup**: When you open Chrome

### Domain Extraction

- Removes `www.` prefix (e.g., `www.github.com` → `github.com`)
- Groups all pages from the same domain together
- Skips Chrome internal pages (`chrome://`, `chrome-extension://`)

## Debugging

### Console Logs

The extension includes comprehensive logging for debugging:

1. **Open Developer Tools**:

   - Right-click the extension icon → "Inspect popup"
   - Or go to `chrome://extensions/` → Click "Inspect views: background page"

2. **Look for these log messages**:
   - `🎯 Background script loaded` - Extension started
   - `🚀 Started new session` - Tracking began
   - `🔚 Ending session` - Session completed
   - `📊 Storage check` - Periodic data verification

### Common Issues

**No data showing up?**

- Check console logs for errors
- Ensure you're browsing actual websites (not Chrome internal pages)
- Try refreshing the popup

**Extension not tracking?**

- Verify the extension is enabled in `chrome://extensions/`
- Check that permissions are granted
- Look for error messages in the console

**Data not persisting?**

- Check Chrome storage quota
- Ensure you're not in incognito mode (data won't persist)

## Development

### Making Changes

1. **Edit the files** as needed
2. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension
3. **Test the changes** by browsing and checking the popup

### Key Files

- **`background.js`**: Core tracking logic - handles all browser events
- **`popup.js`**: Data processing and UI updates
- **`styles.css`**: Visual styling and layout
- **`manifest.json`**: Extension configuration and permissions

## Privacy

- **Local Storage Only**: All data stays on your device
- **No External Servers**: No data is transmitted anywhere
- **No Personal Information**: Only tracks URLs and timestamps
- **You Control Your Data**: You can clear data anytime through Chrome settings

## Future Enhancements

- [ ] Time period filters (this week, all-time)
- [ ] Incognito tracking option
- [ ] Data export functionality
- [ ] Usage goals and limits
- [ ] Detailed page-level analytics
- [ ] Productivity insights

## Troubleshooting

### Extension Not Loading

1. Check that all files are present
2. Verify `manifest.json` syntax
3. Look for errors in Chrome's extension console

### No Data Appearing

1. Check browser console for errors
2. Verify storage permissions
3. Try clearing and reloading the extension

### Performance Issues

1. Check if too many sessions are stored
2. Consider clearing old data
3. Monitor Chrome's storage usage

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify the extension is properly loaded
3. Try reloading the extension
4. Check Chrome's extension permissions

## License

This project is open source and available under the MIT License.
