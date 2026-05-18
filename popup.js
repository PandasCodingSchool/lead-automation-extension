// IndiaMART Lead Auto-Assigner - Popup Script

(function () {
  "use strict";

  // State
  let isRunning = false;
  let teamMembers = [];
  let logs = [];
  let singleAssignee = null;
  let assignMode = "round-robin"; // 'round-robin' or 'single'

  // DOM Elements
  const elements = {
    statusBadge: document.getElementById("status-badge"),
    toggleBtn: document.getElementById("toggle-btn"),
    processedCount: document.getElementById("processed-count"),
    memberCount: document.getElementById("member-count"),
    teamList: document.getElementById("team-list"),
    memberNameInput: document.getElementById("member-name"),
    memberEmailInput: document.getElementById("member-email"),
    addMemberBtn: document.getElementById("add-member-btn"),
    clearMembersBtn: document.getElementById("clear-members-btn"),
    resetBtn: document.getElementById("reset-btn"),
    testSelectorsBtn: document.getElementById("test-selectors-btn"),
    logsContainer: document.getElementById("logs"),
    assignModeRadios: document.querySelectorAll('input[name="assign-mode"]'),
    singleAssigneeContainer: document.getElementById(
      "single-assignee-container",
    ),
    singleAssigneeSelect: document.getElementById("single-assignee-select"),
  };

  // Initialize
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    await loadSettings();
    setupEventListeners();
    renderTeamList();
    updateUI();
    addLog("Extension initialized", "info");
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get([
        "isRunning",
        "teamMembers",
        "processedCount",
        "logs",
        "singleAssignee",
        "assignMode",
      ]);

      isRunning = result.isRunning || false;
      teamMembers = result.teamMembers || [];
      logs = result.logs || [];
      singleAssignee = result.singleAssignee || null;
      assignMode = result.assignMode || "round-robin";

      updateStats(result.processedCount || 0);
      renderLogs();
    } catch (error) {
      console.error("Failed to load settings:", error);
      addLog("Failed to load settings", "error");
    }
  }

  // Save settings to storage
  async function saveSettings() {
    try {
      await chrome.storage.local.set({
        isRunning,
        teamMembers,
        logs: logs.slice(-50), // Keep last 50 logs
        assignMode,
        singleAssignee,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Toggle button
    elements.toggleBtn.addEventListener("click", toggleAutomation);

    // Add member
    elements.addMemberBtn.addEventListener("click", addTeamMember);
    elements.memberNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addTeamMember();
    });
    elements.memberEmailInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addTeamMember();
    });

    // Clear members
    elements.clearMembersBtn.addEventListener("click", clearAllMembers);

    // Reset processed leads
    elements.resetBtn.addEventListener("click", resetProcessedLeads);

    // Test selectors
    elements.testSelectorsBtn.addEventListener("click", testSelectors);

    // Assignment mode radio buttons
    elements.assignModeRadios.forEach((radio) => {
      radio.addEventListener("change", onAssignModeChange);
    });

    // Single assignee dropdown
    elements.singleAssigneeSelect.addEventListener(
      "change",
      onSingleAssigneeChange,
    );
  }

  // Toggle automation on/off
  async function toggleAutomation() {
    if (teamMembers.length === 0) {
      addLog("Add team members before starting", "error");
      alert("Please add at least one team member before starting.");
      return;
    }

    // Check if single assignee mode is selected but no assignee chosen
    if (assignMode === "single" && !singleAssignee) {
      addLog("Please select a single assignee", "error");
      alert(
        "Please select who should receive all leads in the Assignment Mode section.",
      );
      return;
    }

    isRunning = !isRunning;
    await saveSettings();

    // Send message to content script
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs[0]) {
        addLog("No active tab found", "error");
        isRunning = false;
        return;
      }

      const tab = tabs[0];

      // Check if on IndiaMART domain or localhost (for testing)
      const isValidUrl = tab.url && tab.url.includes("indiamart.com");
      if (!isValidUrl) {
        addLog("Not on valid page. Navigate to seller.indiamart.com", "error");
        isRunning = false;
        return;
      }

      // Try to send message - if it fails, try to inject content script
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: isRunning ? "start" : "stop",
        });
      } catch (msgError) {
        // Content script not loaded - try to inject it
        addLog("Injecting content script...", "info");

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });

          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["styles.css"],
          });

          // Wait then send start message (longer wait for script to initialize)
          addLog("Waiting for script to initialize...", "info");
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: isRunning ? "start" : "stop",
              });
              addLog(
                isRunning ? "Started after injection" : "Stopped",
                "success",
              );
            } catch (e) {
              addLog("Script not responding. Try:", "error");
              addLog("1. Refresh the IndiaMART page", "error");
              addLog("2. Click Start again", "error");
              console.error("Message error after injection:", e);
            }
          }, 1500);
        } catch (injectError) {
          addLog("Injection failed: " + injectError.message, "error");
          console.error("Injection error:", injectError);
          isRunning = false;

          // Check if it's a permissions issue
          if (
            injectError.message &&
            injectError.message.includes("Cannot access")
          ) {
            addLog(
              "Try refreshing the page first, then click Start again",
              "error",
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to communicate with content script:", error);
      addLog("Communication error: " + error.message, "error");
      isRunning = false;
    }

    updateUI();
    addLog(
      isRunning ? "Auto-assignment started" : "Auto-assignment stopped",
      isRunning ? "success" : "info",
    );
  }

  // Add team member
  async function addTeamMember() {
    const name = elements.memberNameInput.value.trim();
    const email = elements.memberEmailInput.value.trim();

    if (!name) {
      addLog("Name is required", "error");
      return;
    }

    // Check for duplicates
    if (teamMembers.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      addLog("Team member already exists", "error");
      return;
    }

    teamMembers.push({ name, email });
    await saveSettings();

    // Clear inputs
    elements.memberNameInput.value = "";
    elements.memberEmailInput.value = "";
    elements.memberNameInput.focus();

    renderTeamList();
    updateStats();
    addLog(`Added team member: ${name}`, "success");
  }

  // Remove team member
  async function removeTeamMember(index) {
    const member = teamMembers[index];
    teamMembers.splice(index, 1);
    await saveSettings();

    renderTeamList();
    updateStats();
    addLog(`Removed team member: ${member.name}`, "info");
  }

  // Clear all members
  async function clearAllMembers() {
    if (!confirm("Are you sure you want to remove all team members?")) {
      return;
    }

    teamMembers = [];
    await saveSettings();

    renderTeamList();
    updateStats();
    addLog("All team members cleared", "info");
  }

  // Reset processed leads
  async function resetProcessedLeads() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: "resetProcessed",
        });
      }

      await chrome.storage.local.set({ processedCount: 0 });
      updateStats(0);
      addLog("Processed leads counter reset", "info");
    } catch (error) {
      addLog("Failed to reset counter", "error");
    }
  }

  // Test selectors
  async function testSelectors() {
    addLog("Testing page selectors...", "info");

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) {
        addLog("No active tab found", "error");
        return;
      }

      const tab = tabs[0];

      // Check if on IndiaMART domain or localhost (for testing)
      const isValidTestUrl = tab.url && tab.url.includes("indiamart.com");
      if (!isValidTestUrl) {
        addLog(
          "Not on valid page. Current: " + (tab.url || "unknown"),
          "error",
        );
        return;
      }

      // Try to send message - if it fails, try to inject content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "testSelectors",
        });

        if (response && response.results) {
          const results = response.results;
          let foundCount = 0;
          let totalCount = 0;

          for (const [name, data] of Object.entries(results)) {
            totalCount++;
            if (data.found > 0) foundCount++;
          }

          addLog(
            `Selectors test: ${foundCount}/${totalCount} matched`,
            foundCount > 0 ? "success" : "error",
          );

          // Detailed results in console
          console.log("Selector Test Results:", results);
        }
      } catch (msgError) {
        // Content script not loaded - try to inject it
        addLog("Content script not loaded, attempting to inject...", "info");

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });

          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["styles.css"],
          });

          addLog("Content script injected. Initializing...", "success");

          // Wait longer for script to fully initialize
          setTimeout(async () => {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, {
                action: "testSelectors",
              });
              if (response && response.results) {
                const results = response.results;
                let foundCount = 0;
                let totalCount = 0;
                for (const [name, data] of Object.entries(results)) {
                  totalCount++;
                  if (data.found > 0) foundCount++;
                }
                addLog(
                  `Test: ${foundCount}/${totalCount} selectors matched`,
                  foundCount > 0 ? "success" : "error",
                );
              }
            } catch (e) {
              addLog("Script not responding after injection", "error");
              addLog(
                "Please refresh the IndiaMART page and try again",
                "error",
              );
              console.error("Test error after injection:", e);
            }
          }, 2000);
        } catch (injectError) {
          addLog("Failed to inject: " + injectError.message, "error");
        }
      }
    } catch (error) {
      addLog("Test failed: " + error.message, "error");
    }
  }

  // Render team list
  function renderTeamList() {
    if (teamMembers.length === 0) {
      elements.teamList.innerHTML =
        '<div class="empty-state">No team members added yet</div>';
      return;
    }

    elements.teamList.innerHTML = teamMembers
      .map(
        (member, index) => `
            <div class="team-member">
                <div class="team-member-info">
                    <div class="team-member-name">${escapeHtml(member.name)}</div>
                    ${member.email ? `<div class="team-member-email">${escapeHtml(member.email)}</div>` : ""}
                </div>
                <button class="btn-remove" data-index="${index}">Remove</button>
            </div>
        `,
      )
      .join("");

    // Attach remove handlers
    elements.teamList.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index);
        removeTeamMember(index);
      });
    });

    // Update single assignee dropdown
    updateSingleAssigneeDropdown();
  }

  // Update UI based on state
  function updateUI() {
    if (isRunning) {
      elements.statusBadge.textContent = "Running";
      elements.statusBadge.className = "status-badge running";
      elements.toggleBtn.textContent = "Stop Auto-Assignment";
      elements.toggleBtn.className = "btn btn-stop";
    } else {
      elements.statusBadge.textContent = "Stopped";
      elements.statusBadge.className = "status-badge stopped";
      elements.toggleBtn.textContent = "Start Auto-Assignment";
      elements.toggleBtn.className = "btn btn-start";
    }

    // Update assignment mode radio buttons
    elements.assignModeRadios.forEach((radio) => {
      radio.checked = radio.value === assignMode;
    });

    // Update single assignee container visibility
    elements.singleAssigneeContainer.style.display =
      assignMode === "single" ? "block" : "none";

    // Update single assignee dropdown
    updateSingleAssigneeDropdown();
  }

  // Update single assignee dropdown options
  function updateSingleAssigneeDropdown() {
    // Clear existing options except the first one
    while (elements.singleAssigneeSelect.options.length > 1) {
      elements.singleAssigneeSelect.remove(1);
    }

    // Add team members as options
    teamMembers.forEach((member, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent =
        member.name + (member.email ? ` (${member.email})` : "");
      elements.singleAssigneeSelect.appendChild(option);
    });

    // Select current single assignee if set
    if (singleAssignee) {
      const index = teamMembers.findIndex(
        (m) =>
          m.name === singleAssignee.name && m.email === singleAssignee.email,
      );
      if (index >= 0) {
        elements.singleAssigneeSelect.value = index;
      }
    }
  }

  // Handle assignment mode change
  async function onAssignModeChange(e) {
    assignMode = e.target.value;
    elements.singleAssigneeContainer.style.display =
      assignMode === "single" ? "block" : "none";

    if (assignMode === "round-robin") {
      singleAssignee = null;
    }

    await saveSettings();
    addLog(`Assignment mode changed to: ${assignMode}`, "info");
  }

  // Handle single assignee selection
  async function onSingleAssigneeChange(e) {
    const index = parseInt(e.target.value);
    if (index >= 0 && index < teamMembers.length) {
      singleAssignee = teamMembers[index];
      await saveSettings();
      addLog(`Single assignee set to: ${singleAssignee.name}`, "info");
    } else {
      singleAssignee = null;
      await saveSettings();
    }
  }

  // Update statistics
  function updateStats(processed = null) {
    elements.memberCount.textContent = teamMembers.length;
    if (processed !== null) {
      elements.processedCount.textContent = processed;
    }
  }

  // Add log entry
  function addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };

    logs.unshift(logEntry);
    if (logs.length > 50) logs.pop();

    renderLogs();
    saveSettings();
  }

  // Render logs
  function renderLogs() {
    if (logs.length === 0) {
      elements.logsContainer.innerHTML =
        '<div class="log-entry info">No activity yet</div>';
      return;
    }

    elements.logsContainer.innerHTML = logs
      .map(
        (log) => `
            <div class="log-entry ${escapeHtml(log.type)}">
                [${escapeHtml(log.timestamp)}] ${escapeHtml(log.message)}
            </div>
        `,
      )
      .join("");

    // Scroll to top
    elements.logsContainer.scrollTop = 0;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
      case "notification":
        addLog(request.message, "success");
        // Increment processed count
        const currentCount = parseInt(elements.processedCount.textContent) || 0;
        updateStats(currentCount + 1);
        chrome.storage.local.set({ processedCount: currentCount + 1 });
        break;
      case "log":
        addLog(request.message, request.logType || "info");
        break;
    }
  });
})();
