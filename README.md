# IndiaMART Lead Auto-Assigner - Chrome Extension

A Chrome Extension that automatically assigns new leads to team members on the IndiaMART Seller Panel using API monitoring and round-robin distribution.

## Features

- **API-Based Lead Detection**: Monitors IndiaMART's `getContactList` API to instantly detect new leads
- **Smart Filtering**: Only processes today's unassigned leads (checks `label_count === 0`)
- **Round-Robin Distribution**: Fairly distributes leads among team members
- **Single Assignee Mode**: Option to assign all leads to one specific team member
- **Real-time Assignment**: Automatically clicks through the IndiaMART UI to assign leads
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
│  IndiaMART API  │────▶│  Fetch Monitor   │────▶│  Lead Filter    │
│  getContactList │     │  (Intercept)     │     │ (Today + Unassigned)
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Assignment      │
                        │  Queue           │
└──────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  UI Automation   │
                        │  (Click Lead →   │
                        │   Manage →       │
                        │   Assign →       │
                        │   Close)         │
└──────────────────┘
```

### Assignment Flow

1. **API Detection**: Intercepts `getContactList` API calls
2. **Lead Filtering**: Only processes today's leads with `label_count === 0`
3. **Queue Processing**: Adds unassigned leads to processing queue
4. **UI Automation**:
   - Clicks newest lead (`#contact-0`)
   - Clicks "Manage Lead" button (`#Manege_Lead`)
   - Waits for modal (`#tbro-popup`)
   - Finds "User Defined Labels" section
   - Clicks team member from list
   - Closes modal (`#tbro-header > div > div.cp`)

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
  scanInterval: 3000, // Check for new leads every 3 seconds
  actionDelay: 800, // Delay between actions (ms)
  maxRetries: 3, // Max retry attempts
  debugMode: true, // Enable console logging
};
```

## IndiaMART Selectors

The extension uses these specific selectors for the real IndiaMART Seller Panel:

```javascript
const SELECTORS = {
  // Lead list
  realNewestLead: "#contact-0",

  // Manage Lead button
  realManageBtn: "#Manege_Lead",

  // Assignment modal
  realModal: "#tbro-popup",
  realModalBody: "#tbro-body",
  realUserLabelsHeading: "User Defined Labels",
  realAssignList: "#tbro-body > div:nth-child(1) > div:nth-child(2) > ul",
  realAssignItems: "li",
  realModalClose: "#tbro-header > div > div.cp",
};
```

If IndiaMART updates their UI, you may need to update these selectors in `content.js`.

## Troubleshooting

### Extension Not Working?

1. **Check if on IndiaMART page**: Extension only works on `seller.indiamart.com`
2. **Check console**: Open browser console (F12) for debug logs - look for "[LeadAutoAssigner]" messages
3. **Verify API monitoring**: Look for "Contact API detected" logs when leads load
4. **Reload extension**: Go to `chrome://extensions/` and click reload button

### Selectors Not Matching?

If IndiaMART updates their UI:

1. Open browser DevTools (F12)
2. Inspect the elements:
   - Lead row: `#contact-0`
   - Manage button: `#Manege_Lead`
   - Modal: `#tbro-popup`
   - Close button: `#tbro-header > div > div.cp`
3. Update selectors in `content.js` SELECTORS object
4. Reload the extension

### Leads Not Being Assigned?

1. Ensure team members are added (must match names in IndiaMART exactly)
2. Check that automation is running (green "Running" badge)
3. Verify you're on the Lead Manager page with leads visible
4. Check console for "Contact API detected" message
5. Check that leads are from today and unassigned (label_count = 0)

## Security Notes

- Extension only runs on IndiaMART domains
- No data is sent to external servers
- Team member data stored locally in browser
- Requires manual activation - doesn't run automatically

## Limitations

1. **Active Tab Required**: Browser tab must remain open and active
2. **IndiaMART UI Dependency**: Uses specific selectors that may change
3. **Today's Leads Only**: Only processes leads from current date
4. **Desktop Chrome Only**: Requires Chrome browser on desktop
5. **API Monitoring**: Relies on `getContactList` API being called

## Technical Details

### API Monitoring

The extension intercepts `fetch()` calls to `getContactList` endpoint to detect new leads in real-time without polling.

### Lead Detection Criteria

- Lead date matches today's date
- `label_count === 0` (unassigned)
- Not previously processed in current session

### Assignment Modes

- **Round-Robin**: Distributes leads evenly across all team members
- **Single Assignee**: Assigns all leads to one selected team member

## Development

To modify the extension:

1. Make changes to source files
2. Go to `chrome://extensions/`
3. Click reload button on the extension
4. Test changes immediately

### Adding New Features

1. **Update manifest.json** for new permissions
2. **Modify content.js** for API monitoring or UI automation logic
3. **Update popup.html/js** for UI changes
4. **Test thoroughly** on actual IndiaMART Seller Panel

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
