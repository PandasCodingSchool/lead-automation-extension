# IndiaMART Lead Auto-Assigner - Chrome Extension

A Chrome Extension that automates lead assignment on the IndiaMART Seller Panel using round-robin distribution.

## Features

- **Automated Lead Assignment**: Automatically detects and assigns new unassigned leads
- **Round-Robin Distribution**: Fairly distributes leads among team members
- **Real-time Monitoring**: Constantly scans for new leads every 3 seconds
- **Visual Status Indicator**: Shows processing status directly on the IndiaMART page
- **Team Management**: Easy-to-use popup interface for managing team members
- **Activity Logging**: Tracks all assignment actions with timestamps
- **Browser Notifications**: Alerts when leads are successfully assigned

## Installation

### Method 1: Developer Mode (Recommended for testing)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** button
4. Select the folder containing this extension (`lead-assignmenet-automation`)
5. The extension will appear in your extensions list

### Method 2: Creating a Packaged Extension (.crx)

1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click **Pack extension** button
4. Select the extension folder
5. This creates a `.crx` file for distribution

## Usage

1. **Navigate to IndiaMART Seller Panel**: Open `https://seller.indiamart.com/` and log in to your account

2. **Open the Extension**: 
   - Click the extension icon in Chrome toolbar
   - Or click the status indicator on the page

3. **Add Team Members**:
   - Enter name and email in the popup
   - Click **Add** button
   - Repeat for all team members

4. **Start Automation**:
   - Click **Start Auto-Assignment** button
   - The extension will begin monitoring for new leads
   - Status indicator will show "Running" in green

5. **Monitor Progress**:
   - Watch the activity log in the popup
   - Check the stats for processed leads count
   - Receive browser notifications on successful assignments

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   IndiaMART     │────▶│  Content Script  │────▶│  Lead Detection │
│   Seller Panel  │     │  (content.js)    │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Round-Robin     │
                        │  Assignment      │
                        └──────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Auto-Click UI   │
                        │  Actions         │
                        └──────────────────┘
```

## File Structure

```
lead-assignmenet-automation/
├── manifest.json      # Extension configuration
├── content.js         # Main automation script
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── background.js      # Service worker
├── styles.css         # Content script styles
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## Configuration

The extension can be configured by modifying `content.js`:

```javascript
const CONFIG = {
    scanInterval: 3000,    // Check for new leads every 3 seconds
    actionDelay: 800,      // Delay between actions (ms)
    maxRetries: 3,         // Max retry attempts
    debugMode: true        // Enable console logging
};
```

## CSS Selectors

The extension uses CSS selectors to find elements on the IndiaMART page. These may need updating if IndiaMART changes their website layout:

```javascript
const SELECTORS = {
    leadContainer: '.lead-card, .lead-item, [class*="lead"]',
    assignButton: '.assign-btn, .assign-dropdown',
    teamMemberOption: '.team-member, .agent-option',
    saveButton: '.save-btn, .submit-btn'
};
```

## Troubleshooting

### Extension Not Working?

1. **Check if on IndiaMART page**: Extension only works on `*.indiamart.com` domains
2. **Verify selectors**: Use "Test Page Selectors" button in popup to check if elements are found
3. **Check console**: Open browser console (F12) for debug logs
4. **Reload extension**: Go to `chrome://extensions/` and click reload button

### Selectors Not Matching?

If IndiaMART updates their website:

1. Open browser DevTools (F12)
2. Inspect the lead elements
3. Update selectors in `content.js`
4. Reload the extension

### Leads Not Being Assigned?

1. Ensure team members are added
2. Check that automation is running
3. Verify you're on the Lead Manager page
4. Check for JavaScript errors in console

## Security Notes

- Extension only runs on IndiaMART domains
- No data is sent to external servers
- Team member data stored locally in browser
- Requires manual activation - doesn't run automatically

## Limitations

1. **Active Tab Required**: Browser tab must remain open and active
2. **Selector Fragility**: May break if IndiaMART updates UI
3. **Single Domain**: Only works on IndiaMART Seller Panel
4. **No Mobile Support**: Desktop Chrome only

## Development

To modify the extension:

1. Make changes to source files
2. Go to `chrome://extensions/`
3. Click reload button on the extension
4. Test changes immediately

### Adding New Features

1. **Update manifest.json** for new permissions
2. **Modify content.js** for page automation logic
3. **Update popup.html/js** for UI changes
4. **Test thoroughly** on actual IndiaMART page

## Support

For issues or feature requests:
1. Check the troubleshooting section
2. Review browser console for errors
3. Verify extension has necessary permissions

## Disclaimer

This extension is for educational and productivity purposes. Use at your own risk. Ensure compliance with IndiaMART's Terms of Service before use.

---

**Version**: 1.0.0  
**License**: MIT
