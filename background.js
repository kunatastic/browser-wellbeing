// Background script for tracking website visits and time spent
let currentSession = null;

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    // Remove 'www.' prefix if present
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (error) {
    console.error("Error extracting domain from URL:", url, error);
    return null;
  }
}

// Helper function to get today's date string
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// End current session and save to storage
async function endCurrentSession() {
  if (currentSession) {
    currentSession.end_time = Date.now();
    const sessionDuration = currentSession.end_time - currentSession.start_time;

    console.log("🔚 Ending session:", {
      url: currentSession.url,
      domain: extractDomain(currentSession.url),
      duration: `${Math.round(sessionDuration / 1000)}s`,
      start: new Date(currentSession.start_time).toLocaleTimeString(),
      end: new Date(currentSession.end_time).toLocaleTimeString(),
    });

    try {
      // Get existing sessions
      const result = await chrome.storage.local.get(["sessions"]);
      const sessions = result.sessions || [];

      console.log(`📊 Current sessions in storage: ${sessions.length}`);

      // Add current session
      sessions.push(currentSession);

      // Save back to storage
      await chrome.storage.local.set({ sessions: sessions });

      console.log("✅ Session saved successfully. Total sessions:", sessions.length);
      console.log("💾 Latest session data:", currentSession);
    } catch (error) {
      console.error("❌ Error saving session:", error);
    }

    currentSession = null;
  } else {
    console.log("ℹ️ No active session to end");
  }
}

// Helper function to get favicon URL from page head
async function getFaviconUrl(tabId) {
  try {
    // Check if scripting API is available (Arc compatibility)
    if (!chrome.scripting || !chrome.scripting.executeScript) {
      console.log("⚠️ Scripting API not available, skipping favicon extraction");
      return null;
    }

    // Execute script in the page to extract favicon from head
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Look for favicon in various places in the head
        const faviconSelectors = [
          'link[rel="icon"]',
          'link[rel="shortcut icon"]',
          'link[rel="apple-touch-icon"]',
          'link[rel="apple-touch-icon-precomposed"]',
        ];

        for (const selector of faviconSelectors) {
          const link = document.querySelector(selector);
          if (link && link.href) {
            return link.href;
          }
        }

        // Fallback to default favicon.ico
        return `${window.location.protocol}//${window.location.hostname}/favicon.ico`;
      },
    });

    return results[0]?.result || null;
  } catch (error) {
    console.error("Error extracting favicon from page:", error);
    // Fallback to default favicon.ico
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    } catch (fallbackError) {
      return null;
    }
  }
}

// Start new session
async function startNewSession(url, tabId) {
  const domain = extractDomain(url);
  if (!domain) {
    console.log("⚠️ Invalid URL, skipping session:", url);
    return;
  }

  // Get favicon URL from page head
  const faviconUrl = await getFaviconUrl(tabId);

  currentSession = {
    url: url,
    start_time: Date.now(),
    tabId: tabId,
    favicon: faviconUrl,
  };

  console.log("🚀 Started new session:", {
    url: currentSession.url,
    domain: domain,
    tabId: currentSession.tabId,
    favicon: faviconUrl,
    startTime: new Date(currentSession.start_time).toLocaleTimeString(),
  });
}

// Handle tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log("🔄 Tab activated:", activeInfo.tabId);
  try {
    // End current session
    await endCurrentSession();

    // Get the active tab
    const tab = await chrome.tabs.get(activeInfo.tabId);
    console.log("📄 Active tab URL:", tab.url);

    // Start new session if tab has a valid URL
    if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
      await startNewSession(tab.url, activeInfo.tabId);
    } else {
      console.log("🚫 Skipping Chrome internal page:", tab.url);
    }
  } catch (error) {
    console.error("❌ Error handling tab activation:", error);
  }
});

// Handle tab updates (URL changes within a tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log("🔄 Tab updated:", { tabId, changeInfo, url: tab.url });
  try {
    // Only process when URL changes and tab is complete
    if (changeInfo.url && changeInfo.status === "complete") {
      console.log("📍 URL changed to:", tab.url);

      // End current session if it's the same tab
      if (currentSession && currentSession.tabId === tabId) {
        console.log("🔄 Same tab, ending current session");
        await endCurrentSession();
      }

      // Start new session if it's a valid URL
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
      ) {
        await startNewSession(tab.url, tabId);
      } else {
        console.log("🚫 Skipping Chrome internal page:", tab.url);
      }
    }
  } catch (error) {
    console.error("❌ Error handling tab update:", error);
  }
});

// Handle window focus changes (browser losing/gaining focus)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  console.log("🪟 Window focus changed:", windowId);
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus - end current session
      console.log("👋 Browser lost focus, ending session");
      await endCurrentSession();
    } else {
      // Browser gained focus - get the active tab and start session
      console.log("👀 Browser gained focus, getting active tab");
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        const tab = tabs[0];
        console.log("📄 Active tab on focus:", tab.url);
        if (
          tab.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://")
        ) {
          await endCurrentSession(); // End any existing session
          await startNewSession(tab.url, tab.id);
        } else {
          console.log("🚫 Skipping Chrome internal page on focus:", tab.url);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error handling window focus change:", error);
  }
});

// Handle browser startup - get the active tab
chrome.runtime.onStartup.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
      ) {
        startNewSession(tab.url, tab.id);
      }
    }
  } catch (error) {
    console.error("Error handling startup:", error);
  }
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
      ) {
        startNewSession(tab.url, tab.id);
      }
    }
  } catch (error) {
    console.error("Error handling installation:", error);
  }
});

// Handle browser close - try to save current session
chrome.runtime.onSuspend.addListener(async () => {
  await endCurrentSession();
});

console.log("🎯 Background script loaded - Website time tracker active");
console.log("📊 Extension permissions:", {
  tabs: typeof chrome.tabs !== "undefined",
  storage: typeof chrome.storage !== "undefined",
  windows: typeof chrome.windows !== "undefined",
  runtime: typeof chrome.runtime !== "undefined",
  scripting: typeof chrome.scripting !== "undefined",
});

// Add browser detection for debugging
console.log("🌐 Browser environment:", {
  userAgent: navigator.userAgent,
  isArc: navigator.userAgent.includes("Arc"),
  isChrome: navigator.userAgent.includes("Chrome"),
  chromeAPIs: {
    chrome: typeof chrome !== "undefined",
    storage: typeof chrome !== "undefined" && chrome.storage,
    tabs: typeof chrome !== "undefined" && chrome.tabs,
    windows: typeof chrome !== "undefined" && chrome.windows,
    runtime: typeof chrome !== "undefined" && chrome.runtime,
    scripting: typeof chrome !== "undefined" && chrome.scripting,
  },
});

// Add periodic storage check for debugging
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(["sessions"]);
    const sessions = result.sessions || [];
    console.log(`📈 Storage check: ${sessions.length} sessions stored`);
    if (sessions.length > 0) {
      const latest = sessions[sessions.length - 1];
      console.log("📋 Latest session:", {
        url: latest.url,
        domain: extractDomain(latest.url),
        duration: latest.end_time
          ? `${Math.round((latest.end_time - latest.start_time) / 1000)}s`
          : "ongoing",
        time: new Date(latest.start_time).toLocaleTimeString(),
      });
    }
  } catch (error) {
    console.error("❌ Storage check failed:", error);
  }
}, 30000); // Check every 30 seconds
