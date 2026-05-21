// IndiaMART Lead Auto-Assigner - Content Script
// This script runs directly on IndiaMART Seller Panel pages

(function () {
  "use strict";

  console.log(
    "[LeadAutoAssigner] Content script loaded on:",
    window.location.href,
  );

  // Configuration
  const CONFIG = {
    scanInterval: 3000, // Check for new leads every 3 seconds
    actionDelay: 800, // Delay between actions (ms)
    maxRetries: 3, // Max retry attempts for failed assignments
    debugMode: true, // Enable console logging
  };

  // State
  let isRunning = false;
  let teamMembers = [];
  let currentIndex = 0;
  let processedLeads = new Set(); // Track already processed lead IDs
  let retryCount = 0;
  let singleAssignee = null; // Specific member to assign all leads to (null = round-robin mode)
  let scanIntervalId = null; // Interval ID for periodic lead polling
  let capturedContactListUrl = null; // Real getContactList URL captured from fetch interceptor
  let capturedContactListInit = null; // Real request init (headers, method, body) captured from fetch interceptor
  let pollSkipCount = 0; // Count of skipped polls due to missing URL
  const MAX_POLL_SKIPS = 10; // Auto-reload after this many skips (~30 seconds)

  // CSS Selectors for IndiaMART (Real site + Mock page)
  const SELECTORS = {
    // ===== REAL INDIAMART SELECTORS (from Tampermonkey script) =====
    // Lead list - newest lead is #contact-0, #contact-1, etc.
    realLeadContainer: '#contact-0, #contact-1, #contact-2, [id^="contact-"]',
    realNewestLead: "#contact-0",
    realLeadIdAttr: "im_contact_id",

    // Manage Lead button
    realManageBtn: "#Manege_Lead",

    // Assignment modal
    realModal: "#tbro-popup",
    realModalBody: "#tbro-body",
    realUserLabelsHeading: "User Defined Labels",
    realAssignList: "#tbro-body > div:nth-child(1) > div:nth-child(2) > ul",
    realAssignItems: "li",
    realModalClose: "#tbro-header > div > div.cp",

    // Suggested replies section
    suggestedRepliesContainer: "#suggested_replies",
    suggestedReplyItem: ".reply-template",

    // Message input box for sending reply
    messageInputBox: "#massage-text",
    messageInputContainer: "#editable_div",

    // Note: All mock selectors removed - using real IndiaMART API monitoring only
  };

  // Logger utility - sends to both console and popup
  const logger = {
    log: (...args) => {
      const msg = args.join(" ");
      CONFIG.debugMode && console.log("[LeadAutoAssigner]", ...args);
      sendLogToPopup(msg, "info");
    },
    error: (...args) => {
      const msg = args.join(" ");
      console.error("[LeadAutoAssigner]", ...args);
      sendLogToPopup(msg, "error");
    },
    warn: (...args) => {
      const msg = args.join(" ");
      console.warn("[LeadAutoAssigner]", ...args);
      sendLogToPopup(msg, "warning");
    },
  };

  // Send log message to popup
  function sendLogToPopup(message, type = "info") {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: "log",
          message: message,
          logType: type,
        });
      }
    } catch (e) {
      // Ignore errors - popup might be closed
    }
  }

  // Get team members from storage
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get([
        "teamMembers",
        "currentIndex",
        "isRunning",
        "singleAssignee",
      ]);
      teamMembers = result.teamMembers || [];
      currentIndex = result.currentIndex || 0;
      isRunning = result.isRunning || false;
      singleAssignee = result.singleAssignee || null;
      logger.log("Settings loaded:", {
        teamMembers,
        currentIndex,
        isRunning,
        singleAssignee,
      });
    } catch (error) {
      logger.error("Failed to load settings:", error);
    }
  }

  // Save current index to storage
  async function saveCurrentIndex() {
    try {
      await chrome.storage.local.set({ currentIndex });
    } catch (error) {
      logger.error("Failed to save index:", error);
    }
  }

  // Get team member for assignment (single assignee or round-robin)
  function getNextTeamMember() {
    if (teamMembers.length === 0) {
      logger.warn("No team members configured");
      return null;
    }
    // Single assignee mode - always return the same member
    if (singleAssignee) {
      logger.log(
        "Single assignee mode: assigning to",
        singleAssignee.name || singleAssignee.email,
      );
      return singleAssignee;
    }
    // Round-robin mode
    const member = teamMembers[currentIndex];
    currentIndex = (currentIndex + 1) % teamMembers.length;
    saveCurrentIndex();
    return member;
  }

  // Find elements with multiple selector strategies
  function findElement(selectors, parent = document) {
    if (typeof selectors === "string") {
      return parent.querySelector(selectors);
    }
    for (const selector of selectors) {
      try {
        const element = parent.querySelector(selector);
        if (element) return element;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return null;
  }

  // Find all matching elements
  function findAllElements(selectors, parent = document) {
    if (typeof selectors === "string") {
      return Array.from(parent.querySelectorAll(selectors));
    }
    for (const selector of selectors) {
      try {
        const elements = parent.querySelectorAll(selector);
        if (elements.length > 0) return Array.from(elements);
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return [];
  }

  // Simulate human-like click
  function simulateClick(element) {
    if (!element) return false;

    try {
      // Create and dispatch mouse events
      const events = ["mousedown", "click", "mouseup"];
      events.forEach((eventType) => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        element.dispatchEvent(event);
      });

      // Also call click() method as fallback
      element.click();
      return true;
    } catch (error) {
      logger.error("Click simulation failed:", error);
      return false;
    }
  }

  // Delay utility
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Send browser notification
  function sendNotification(message) {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: "notification",
        message: message,
      });
    }
  }

  // ==================== INTERVAL-BASED LEAD POLLING ====================

  // Fetch leads from getContactList API and process unassigned ones
  async function pollForNewLeads() {
    if (!isRunning) return;
    if (!capturedContactListUrl) {
      pollSkipCount++;
      logger.warn(
        `Poll skipped (${pollSkipCount}/${MAX_POLL_SKIPS}): waiting for IndiaMART to make first getContactList call to capture URL`,
      );
      // Auto-reload page if we keep missing the API call
      if (pollSkipCount >= MAX_POLL_SKIPS) {
        logger.error(
          "API not detected after multiple attempts. Reloading page to retry detection...",
        );
        setTimeout(() => window.location.reload(), 2000);
      }
      return;
    }
    // Reset skip count once we have the URL
    pollSkipCount = 0;
    try {
      logger.log("Polling for new leads...");
      const response = await fetch(
        capturedContactListUrl,
        capturedContactListInit,
      );
      if (!response.ok) {
        logger.warn("Poll request failed:", response.status);
        return;
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        logger.error(
          `Poll returned non-JSON (${contentType}). URL used: ${capturedContactListUrl}. Response preview: ${text.substring(0, 100)}`,
        );
        capturedContactListUrl = null; // reset so interceptor can re-capture correct URL
        capturedContactListInit = null;
        return;
      }
      const data = await response.json();
      logger.log("Poll successful");
      processLeadsFromAPI(data);
    } catch (err) {
      logger.error("Poll error:", err);
    }
  }

  // Try to discover getContactList URL from already-completed network requests
  // NOTE: disabled - performance entries don't capture POST body/headers so the
  // replayed request returns HTML. Only the fetch interceptor captures accurate init.
  function discoverContactListUrl() {
    // no-op: rely on fetch interceptor capture only
  }

  // Start interval polling
  function startIntervalPolling() {
    if (scanIntervalId) return; // already running
    discoverContactListUrl(); // try to capture URL from past requests before first poll
    logger.log(`Starting interval polling every ${CONFIG.scanInterval}ms`);
    scanIntervalId = setInterval(pollForNewLeads, CONFIG.scanInterval);
  }

  // Stop interval polling
  function stopIntervalPolling() {
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
      logger.log("Interval polling stopped");
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.log("Message received:", request);

    switch (request.action) {
      case "start":
        isRunning = true;
        loadSettings().then(() => {
          logger.log("Auto-assigner started - monitoring API for new leads");
          // API monitoring (fetch interceptor) handles assignment automatically
          startIntervalPolling();
        });
        sendResponse({ status: "started" });
        break;

      case "stop":
        isRunning = false;
        stopIntervalPolling();
        logger.log("Auto-assigner stopped");
        sendResponse({ status: "stopped" });
        break;

      case "getStatus":
        sendResponse({
          isRunning,
          teamMembers: teamMembers.length,
          processedCount: processedLeads.size,
        });
        break;

      case "resetProcessed":
        processedLeads.clear();
        currentIndex = 0;
        saveCurrentIndex();
        logger.log("Processed leads cleared");
        sendResponse({ status: "reset" });
        break;

      case "updateSettings":
        teamMembers = request.teamMembers || teamMembers;
        chrome.storage.local.set({ teamMembers });
        sendResponse({ status: "settingsUpdated" });
        break;

      case "testSelectors":
        const testResults = testSelectors();
        sendResponse({ results: testResults });
        break;

      case "reloadPage":
        logger.log("Reloading page to re-detect API...");
        setTimeout(() => window.location.reload(), 500);
        sendResponse({ status: "reloading" });
        break;

      case "forceDetect":
        // Manually trigger detection by resetting URL capture and reloading
        capturedContactListUrl = null;
        capturedContactListInit = null;
        pollSkipCount = 0;
        logger.log("Forcing API re-detection by reloading page...");
        setTimeout(() => window.location.reload(), 500);
        sendResponse({ status: "reloading" });
        break;
    }

    return true; // Keep channel open for async
  });

  // Test if selectors are working
  function testSelectors() {
    const results = {};
    for (const [name, selector] of Object.entries(SELECTORS)) {
      const elements = findAllElements(selector);
      results[name] = {
        found: elements.length,
        selector: selector,
      };
    }
    logger.log("Selector test results:", results);
    return results;
  }

  // ==================== REAL INDIAMART API MONITORING ====================

  // Shared lead processing logic used by both fetch interceptor and interval polling
  function processLeadsFromAPI(data) {
    // Support both old API (result) and new API (response)
    const leads = data?.result || data?.response;
    if (!data || !leads || !Array.isArray(leads)) {
      logger.warn("No leads array in API response", data);
      return;
    }

    logger.log(`Received ${leads.length} leads from API`);

    leads.forEach((lead) => {
      try {
        const contactId = lead.im_contact_id;
        const leadDate = lead.contacts_add_date;
        const labelCount = parseInt(lead.label_count || "0");

        // Only process today's leads
        if (!isTodayLead(leadDate)) return;

        // Skip already processed
        if (processedLeads.has(contactId)) return;
        processedLeads.add(contactId);

        // Check if unassigned (labelCount === 0)
        const isUnassigned = labelCount === 0;
        logger.log(
          `Lead: ${lead.contacts_name} | Labels: ${labelCount} | Unassigned: ${isUnassigned}`,
        );

        if (isUnassigned && isRunning) {
          logger.log(`NEW UNASSIGNED LEAD FOUND: ${lead.contacts_name}`);
          // Add to queue for processing
          realIndiaMARTQueue.push({
            contactId,
            name: lead.contacts_name,
          });
          processRealIndiaMARTQueue();
        }
      } catch (err) {
        logger.error("Lead processing error:", err);
      }
    });
  }

  // Listen for getContactList data posted by the main-world interceptor (interceptor.js)
  console.log("[LeadAutoAssigner][CONTENT] Setting up message listener...");
  window.addEventListener("message", (event) => {
    console.log("[LeadAutoAssigner][CONTENT] Message received:", event.data);

    if (event.source !== window) {
      console.log("[LeadAutoAssigner][CONTENT] Ignoring - wrong source");
      return;
    }
    if (!event.data) {
      console.log("[LeadAutoAssigner][CONTENT] Ignoring - no data");
      return;
    }
    if (event.data.source !== "LeadAutoAssignerInterceptor") {
      console.log(
        "[LeadAutoAssigner][CONTENT] Ignoring - wrong source identifier:",
        event.data.source,
      );
      return;
    }
    if (event.data.type !== "contactListData") {
      console.log(
        "[LeadAutoAssigner][CONTENT] Ignoring - wrong type:",
        event.data.type,
      );
      return;
    }

    logger.log("Contact API detected via message from interceptor");

    // Capture URL + init for interval polling reuse
    if (!capturedContactListUrl) {
      capturedContactListUrl = event.data.url;
      capturedContactListInit = event.data.init
        ? { ...event.data.init, credentials: "include" }
        : { credentials: "include" };
      logger.log(
        "Captured getContactList URL for polling:",
        capturedContactListUrl,
      );
    }

    processLeadsFromAPI(event.data.data);
  });
  console.log("[LeadAutoAssigner][CONTENT] Message listener ACTIVE");

  // Check if lead is from today
  function isTodayLead(dateString) {
    if (!dateString) return false;
    const today = new Date().toISOString().split("T")[0];
    return dateString.startsWith(today);
  }

  // Queue for real IndiaMART leads
  const realIndiaMARTQueue = [];
  let isProcessingRealQueue = false;

  // Process real IndiaMART assignment queue
  async function processRealIndiaMARTQueue() {
    if (isProcessingRealQueue) return;
    isProcessingRealQueue = true;

    while (realIndiaMARTQueue.length > 0 && isRunning) {
      const lead = realIndiaMARTQueue.shift();
      try {
        logger.log(`Processing Lead: ${lead.name}`);
        await assignLeadRealIndiaMART();
      } catch (err) {
        logger.error("Queue processing failed:", err);
      }
      await delay(2000);
    }

    isProcessingRealQueue = false;
  }

  // Assign lead on real IndiaMART using Tampermonkey logic
  async function assignLeadRealIndiaMART() {
    const teamMember = getNextTeamMember();
    if (!teamMember) {
      logger.error("No team member configured");
      return;
    }

    try {
      // Step 1: Click newest lead
      const newestLead = document.querySelector(SELECTORS.realNewestLead);
      if (!newestLead) {
        logger.warn("Newest lead (#contact-0) not found");
        return;
      }
      logger.log("Clicking newest lead");
      simulateClick(newestLead);
      await delay(1500);

      // Step 2: Click Manage Lead button
      const manageBtn = document.querySelector(SELECTORS.realManageBtn);
      if (!manageBtn) {
        logger.warn("Manage Lead button (#Manege_Lead) not found");
        return;
      }
      logger.log("Opening Manage Lead");
      simulateClick(manageBtn);
      await delay(1800);

      // Step 3: Wait for modal
      const modal = document.querySelector(SELECTORS.realModal);
      if (!modal) {
        logger.warn("Manage modal (#tbro-popup) not found");
        return;
      }
      logger.log("Modal opened");

      // Step 4: Find User Defined Labels section
      const allDivs = modal.querySelectorAll("div");
      let labelHeadingFound = false;
      for (const div of allDivs) {
        if (div.innerText?.trim() === SELECTORS.realUserLabelsHeading) {
          labelHeadingFound = true;
          break;
        }
      }
      if (!labelHeadingFound) {
        logger.warn("'User Defined Labels' heading not found");
        closeRealModal();
        return;
      }
      logger.log("User Defined Labels section found");

      // Step 5: Find assign list
      const assignList = document.querySelector(SELECTORS.realAssignList);
      if (!assignList) {
        logger.warn("Assign list not found");
        closeRealModal();
        return;
      }
      logger.log("Assign list found");

      // Step 6: Find team member
      const assignItems = assignList.querySelectorAll(
        SELECTORS.realAssignItems,
      );
      let memberFound = false;
      const targetName = (teamMember.name || teamMember.email).toLowerCase();

      for (const item of assignItems) {
        const text = item.innerText?.trim().toLowerCase();
        logger.log(`Found User: ${text}`);

        if (text.includes(targetName)) {
          memberFound = true;
          logger.log(`Assigning to ${teamMember.name || teamMember.email}`);
          simulateClick(item);
          await delay(1500);
          break;
        }
      }

      if (!memberFound) {
        logger.warn(
          `${teamMember.name || teamMember.email} not found in assign list`,
        );
      }

      // Step 7: Send suggested reply matching team member name
      await sendSuggestedReply(teamMember);

      // Step 8: Close modal
      closeRealModal();
      logger.log("Lead Assigned Successfully");

      // Send notification and update stats
      sendNotification(
        `Lead assigned to ${teamMember.name || teamMember.email}`,
      );
    } catch (err) {
      logger.error("Assign process failed:", err);
      closeRealModal();
    }
  }

  // Close real IndiaMART modal
  function closeRealModal() {
    try {
      const closeBtn = document.querySelector(SELECTORS.realModalClose);
      if (closeBtn) {
        logger.log("Closing modal");
        simulateClick(closeBtn);
      }
    } catch (err) {
      logger.error("Close modal failed:", err);
    }
  }

  // Send suggested reply matching team member name
  // Only sends if lead is assigned to Yogesh (not if already assigned to someone else)
  async function sendSuggestedReply(teamMember) {
    try {
      const targetName = (teamMember.name || teamMember.email)
        .toLowerCase()
        .trim();
      if (!targetName) {
        logger.warn("No team member name to match for suggested reply");
        return;
      }

      // Only send suggested reply for Yogesh-assigned leads
      if (!targetName.includes("yogesh")) {
        logger.log(
          `Skipping suggested reply - lead assigned to ${teamMember.name || teamMember.email} (not Yogesh)`,
        );
        return;
      }

      logger.log(`Looking for suggested reply matching: "${targetName}"`);

      // Find suggested replies container
      const container = document.querySelector(
        SELECTORS.suggestedRepliesContainer,
      );
      if (!container) {
        logger.log("Suggested replies section not found - skipping");
        return;
      }

      // Find all reply items
      const replyItems = container.querySelectorAll(
        SELECTORS.suggestedReplyItem,
      );
      if (replyItems.length === 0) {
        logger.log("No suggested reply templates found");
        return;
      }

      logger.log(`Found ${replyItems.length} suggested replies`);

      // Look for reply matching team member name (in title or text content)
      let matchingReply = null;
      for (const item of replyItems) {
        const title = (item.getAttribute("title") || "").toLowerCase();
        const text = (item.innerText || "").toLowerCase().trim();

        logger.log(
          `Checking reply - text: "${text}", title includes name: ${title.includes(targetName)}`,
        );

        // Check if team member name appears in title or text
        if (title.includes(targetName) || text.includes(targetName)) {
          matchingReply = item;
          logger.log(
            `Found matching suggested reply for ${teamMember.name || teamMember.email}`,
          );
          break;
        }
      }

      if (!matchingReply) {
        logger.warn(`No suggested reply found containing "${targetName}"`);
        return;
      }

      // Click the suggested reply to load it into message box
      logger.log("Clicking suggested reply to load into message box...");
      simulateClick(matchingReply);
      await delay(1000);

      // Find message input and press Enter to send
      const messageBox = document.querySelector(SELECTORS.messageInputBox);
      if (!messageBox) {
        logger.warn(
          "Message input box not found after clicking suggested reply",
        );
        return;
      }

      // Check if message was actually loaded (has content)
      const messageText = messageBox.innerText || messageBox.textContent || "";
      if (!messageText.trim()) {
        logger.warn("Message box is empty after clicking suggested reply");
        return;
      }

      logger.log(
        `Message loaded (${messageText.length} chars), pressing Enter to send...`,
      );

      // Press Enter to send the message
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      messageBox.dispatchEvent(enterEvent);

      // Also try keypress and keyup for better compatibility
      const keypressEvent = new KeyboardEvent("keypress", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      messageBox.dispatchEvent(keypressEvent);

      const keyupEvent = new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      messageBox.dispatchEvent(keyupEvent);

      await delay(1000);
      logger.log("Suggested reply sent successfully (Enter key pressed)");
    } catch (err) {
      logger.error("Failed to send suggested reply:", err);
    }
  }

  // ==================== DYNAMIC INTERCEPTOR INJECTION ====================

  // Inject interceptor script directly into page as a fallback/reliable method
  function injectInterceptorScript() {
    console.log(
      "[LeadAutoAssigner][CONTENT] Attempting to inject interceptor script...",
    );
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("interceptor.js");
      script.onload = function () {
        console.log(
          "[LeadAutoAssigner][CONTENT] Interceptor script injected successfully",
        );
        this.remove();
      };
      script.onerror = function (err) {
        console.error(
          "[LeadAutoAssigner][CONTENT] Failed to inject interceptor:",
          err,
        );
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.error(
        "[LeadAutoAssigner][CONTENT] Error injecting interceptor:",
        err,
      );
    }
  }

  // ==================== INITIALIZE ====================

  async function init() {
    console.log("[LeadAutoAssigner][CONTENT] init() starting...");
    await loadSettings();

    console.log("[LeadAutoAssigner][CONTENT] Injecting interceptor script...");
    injectInterceptorScript();

    logger.log("Lead Auto-Assigner initialized");

    // Add visual indicator - wait for body if not ready yet
    if (document.body) {
      addStatusIndicator();
    } else {
      document.addEventListener("DOMContentLoaded", addStatusIndicator);
    }
    console.log("[LeadAutoAssigner][CONTENT] init() complete");
  }

  // Add visual status indicator to page
  function addStatusIndicator() {
    const indicator = document.createElement("div");
    indicator.id = "lead-auto-assigner-status";
    indicator.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #333;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                z-index: 10000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">
                <span id="assigner-status-text">Lead Auto-Assigner: Stopped</span>
                <span id="assigner-member-count" style="margin-left: 10px; color: #aaa;">(${teamMembers.length} members)</span>
            </div>
        `;

    document.body.appendChild(indicator);

    // Update status periodically
    setInterval(() => {
      const statusText = document.getElementById("assigner-status-text");
      const memberCount = document.getElementById("assigner-member-count");
      if (statusText) {
        statusText.textContent = `Lead Auto-Assigner: ${isRunning ? "Running" : "Stopped"}`;
        statusText.style.color = isRunning ? "#4CAF50" : "#f44336";
      }
      if (memberCount) {
        memberCount.textContent = `(${teamMembers.length} members, ${processedLeads.size} processed)`;
      }
    }, 1000);
  }

  // Run initialization with error handling
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  } catch (error) {
    console.error("[LeadAutoAssigner] Init failed:", error);
  }

  // Also register message listener immediately for programmatic injection
  console.log("[LeadAutoAssigner] Message listener registered");
})();
