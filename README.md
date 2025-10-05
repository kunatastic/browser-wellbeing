# Browser Digital Wellbeing Extension

A Chrome extension that tracks your website usage and displays time spent on each domain to help you understand your digital habits.

## Features

- **Real-time Tracking**: Automatically tracks time spent on websites with precise session management
- **Domain-based Analytics**: Groups time by domain (e.g., all GitHub pages as "github.com")
- **Today's View**: Shows consolidated usage for the current day with beautiful progress bars
- **Tab Switch Detection**: Handles switching between tabs and windows seamlessly
- **Local Storage**: All data stored locally in your browser using Chrome's storage API
- **Session Management**: Tracks individual browsing sessions with start/end times

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

## Technical Details

### TypeScript Architecture

The extension is built with a modern TypeScript architecture:

- **Service Worker**: `background.ts` runs as a service worker (Manifest V3)
- **Content Script**: `content.ts` injects into web pages for enhanced tracking
- **Popup Script**: `popup.ts` handles the UI and data visualization
- **Helper Functions**: `helper.ts` contains shared utilities
- **Type Safety**: Full TypeScript coverage with Chrome extension types
- **Build System**: TypeScript compiler with watch mode for development

### Common Issues (WIP)

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

## Privacy

- **Local Storage Only**: All data stays on your device
- **No External Servers**: No data is transmitted anywhere
- **No Personal Information**: Only tracks URLs and timestamps
- **You Control Your Data**: You can clear data anytime through Chrome settings

## Future Enhancements

- [ ] Time period filters (this week, this month, all-time)
- [ ] Data export functionality (CSV, JSON)
- [ ] Usage goals and daily limits with notifications
- [ ] Detailed page-level analytics (individual URLs)
- [ ] Productivity insights and recommendations
- [ ] Dark/light theme toggle
- [ ] Data visualization charts and graphs
- [ ] Website categorization (work, social, entertainment)
- [ ] Focus mode with website blocking
- [ ] Weekly/monthly usage reports
- [ ] Integration with productivity tools

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
