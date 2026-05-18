// IndiaMART Lead Auto-Assigner - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
    console.log('IndiaMART Lead Auto-Assigner installed');
    
    // Initialize default settings
    chrome.storage.local.set({
        isRunning: false,
        teamMembers: [],
        currentIndex: 0,
        processedCount: 0,
        logs: []
    });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'notification':
            // Show browser notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Lead Auto-Assigner',
                message: request.message
            });
            break;
            
        case 'log':
            // Forward logs to popup if open
            console.log('[LeadAutoAssigner]', request.message);
            break;
    }
});

// Monitor tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('indiamart.com')) {
            console.log('IndiaMART page detected:', tab.url);
        }
    }
});
