# Testing the Extension Without IndiaMART Access

## Overview

Since you don't have access to the real IndiaMART seller portal, use this mock page to test the extension's functionality.

## Setup

### Step 1: Start a Local Server

Open terminal and run:

```bash
cd /Users/pankajpandey/workspace/lead-assignmenet-automation/test
python3 -m http.server 8080
```

Or with Node.js:
```bash
npx serve -p 8080
```

### Step 2: Update Extension Permissions

Edit `/Users/pankajpandey/workspace/lead-assignmenet-automation/manifest.json` to allow localhost:

```json
{
  "host_permissions": [
    "https://seller.indiamart.com/*",
    "https://*.indiamart.com/*",
    "http://localhost:8080/*",
    "http://127.0.0.1:8080/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://seller.indiamart.com/*",
        "https://*.indiamart.com/*",
        "http://localhost:8080/*",
        "http://127.0.0.1:8080/*"
      ],
      ...
    }
  ]
}
```

### Step 3: Reload Extension

1. Go to `chrome://extensions/`
2. Find "IndiaMART Lead Auto-Assigner"
3. Click the reload button (🔄)

### Step 4: Open Mock Page

Navigate to: `http://localhost:8080/mock-indiamart.html`

## Testing Workflow

1. **Add Team Members** in the extension popup
2. **Click "Test Page Selectors"** - should detect the mock lead cards
3. **Click "Start Auto-Assignment"**
4. **Click "Add New Lead"** on the mock page
5. **Watch the magic happen** - the extension should auto-assign the new lead!

## What to Expect

### When "Test Page Selectors" Works:
- Log shows: `Selectors test: X/9 matched`
- The extension found the lead cards, assign buttons, dropdowns

### When Auto-Assignment Works:
- You click "Add New Lead" on mock page
- Extension detects the new unassigned lead
- Extension clicks "Assign" dropdown
- Extension selects a team member
- Extension clicks "Save"
- Mock page shows: "✓ Assigned to: [Team Member]"

## Troubleshooting

### "Not on IndiaMART page" Error
Make sure you're on `http://localhost:8080/mock-indiamart.html` when clicking extension buttons.

### Selectors Not Matching
The mock page uses CSS classes like:
- `.lead-card` - for lead containers
- `.assign-btn` - for assign buttons
- `.dropdown-menu` - for the dropdown
- `.team-member` - for team member options
- `.save-btn` - for save button

If the extension can't find them, check browser console (F12) for debug messages.

### Extension Not Injecting
Try refreshing the mock page after loading the extension.

## Mock Page Features

- **3 initial unassigned leads** - ready for testing
- **"Add New Lead" button** - simulates new incoming leads
- **Manual assignment dropdown** - you can also assign manually
- **Visual status indicators** - shows assigned vs unassigned

## How It Works

The mock page simulates:
1. Lead cards with proper CSS classes
2. Unassigned status badges
3. Assignment dropdowns with team members
4. Save buttons

The extension treats it exactly like the real IndiaMART page!
