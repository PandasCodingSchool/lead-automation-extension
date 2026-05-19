// IndiaMART Lead Auto-Assigner - Fetch Interceptor (Main World)
// Runs in the page's main world to intercept IndiaMART's fetch calls

(function () {
  "use strict";

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      if (url.includes("getContactList")) {
        const cloned = response.clone();
        cloned
          .json()
          .then((data) => {
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
          })
          .catch(() => {});
      }
    } catch (e) {}

    return response;
  };

  console.log("[LeadAutoAssigner] Fetch interceptor injected into main world");
})();
