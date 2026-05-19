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
      logger.warn(
        "Poll skipped: waiting for IndiaMART to make first getContactList call to capture URL",
      );
      return;
    }
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
    if (!data || !data.result) {
      logger.warn("No result array in API");
      return;
    }

    const leads = data.result;
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
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== "LeadAutoAssignerInterceptor" ||
      event.data.type !== "contactListData"
    )
      return;

    logger.log("Contact API detected");

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

      // Step 7: Close modal
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

  // ==================== INITIALIZE ====================

  async function init() {
    await loadSettings();

    // autoAssignLoop is now a continuous loop that handles its own timing
    // It will be started when user clicks "Start" and runs until stopped

    logger.log("Lead Auto-Assigner initialized");

    // Add visual indicator - wait for body if not ready yet (document_start)
    if (document.body) {
      addStatusIndicator();
    } else {
      document.addEventListener("DOMContentLoaded", addStatusIndicator);
    }
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
