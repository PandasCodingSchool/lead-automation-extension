// IndiaMART Lead Auto-Assigner - Fetch Interceptor (Main World)
// Runs in the page's main world to intercept IndiaMART's fetch calls

(function () {
  "use strict";

  console.log("[LeadAutoAssigner][INTERCEPTOR] Script starting...");

  const originalFetch = window.fetch;
  console.log(
    "[LeadAutoAssigner][INTERCEPTOR] Original fetch captured:",
    typeof originalFetch,
  );

  window.fetch = async function (...args) {
    const url =
      typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
    console.log(
      "[LeadAutoAssigner][INTERCEPTOR] fetch() called:",
      url.substring(0, 100),
    );

    const response = await originalFetch.apply(this, args);

    try {
      // Support both old and new IndiaMART API endpoints
      const isContactList =
        url.includes("getContactList") || url.includes("getSortFilterLeads");
      if (isContactList) {
        console.log(
          "[LeadAutoAssigner][INTERCEPTOR] Leads API DETECTED:",
          url.includes("getSortFilterLeads")
            ? "getSortFilterLeads"
            : "getContactList",
        );
        const cloned = response.clone();
        cloned
          .json()
          .then((data) => {
            console.log(
              "[LeadAutoAssigner][INTERCEPTOR] Response parsed, posting message...",
            );
            window.postMessage(
              {
                source: "LeadAutoAssignerInterceptor",
                type: "contactListData",
                url: url,
                init: args[1] ? JSON.parse(JSON.stringify(args[1])) : null,
                data: data,
              },
              "*",
            );
            console.log(
              "[LeadAutoAssigner][INTERCEPTOR] Message posted successfully",
            );
          })
          .catch((err) => {
            console.error(
              "[LeadAutoAssigner][INTERCEPTOR] JSON parse error:",
              err,
            );
          });
      }
    } catch (e) {
      console.error("[LeadAutoAssigner][INTERCEPTOR] Error in interceptor:", e);
    }

    return response;
  };

  console.log(
    "[LeadAutoAssigner][INTERCEPTOR] Fetch interceptor ACTIVE - waiting for getContactList calls",
  );
})();
