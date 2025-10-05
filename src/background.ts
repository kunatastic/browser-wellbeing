/// <reference types="chrome-types" />
// Background script for tracking website visits and time spent

let currentSession: Session | null = null;

// Helper function to extract domain from URL
function extractDomain(url: string): string | null {
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

// Update session - handles both starting new sessions and updating existing ones
async function updateSession(url: string, tabId: number): Promise<void> {
  const domain = extractDomain(url);
  if (!domain) {
    console.log("⚠️ Invalid URL, skipping session:", url);
    return;
  }

  const currentTime = Date.now();

  try {
    // Get existing sessions
    const result = await chrome.storage.local.get(["sessions"]);
    const sessions: Session[] = result.sessions || [];

    // If there's a current session, update it with end time
    if (currentSession) {
      currentSession.endAt = currentTime;
      const sessionDuration = currentSession.endAt - currentSession.startAt;

      console.log("🔚 Ending current session:", {
        domain: currentSession.domain,
        duration: `${Math.round(sessionDuration / 1000)}s`,
        start: new Date(currentSession.startAt).toLocaleTimeString(),
        end: new Date(currentSession.endAt).toLocaleTimeString(),
      });

      // Add the completed session to storage
      sessions.push(currentSession);
    }

    // Get page metadata (favicon, title, description) from content script
    const pageMetadata = await getPageMetadata(tabId);

    // Start new session
    currentSession = {
      domain: domain,
      startAt: currentTime,
      tabId: tabId,
      favicon: pageMetadata.favicon || undefined,
      title: pageMetadata.title || undefined,
      description: pageMetadata.description || undefined,
      startAtReadable: new Date(currentTime).toLocaleTimeString(),
      endAtReadable: new Date(currentTime).toLocaleTimeString(),
    };

    console.log("🚀 Started new session:", {
      domain: domain,
      tabId: currentSession.tabId,
      favicon: pageMetadata.favicon,
      title: pageMetadata.title,
      startTime: new Date(currentSession.startAt).toLocaleTimeString(),
    });

    // Save updated sessions to storage
    await chrome.storage.local.set({ sessions: sessions });

    console.log("✅ Sessions updated successfully. Total sessions:", sessions.length);
  } catch (error) {
    console.error("❌ Error updating session:", error);
  }
}

// Helper function to get page metadata using content script
async function getPageMetadata(
  tabId: number
): Promise<{ favicon: string | null; title: string | null; description: string | null }> {
  try {
    // Send message to content script to extract metadata
    const response = await chrome.tabs.sendMessage(tabId, { action: "extractMetadata" });

    if (response && response.success) {
      return {
        favicon: response.metadata.favicon,
        title: response.metadata.title,
        description: response.metadata.description,
      };
    } else {
      console.warn("Content script failed to extract metadata:", response?.error);
      return { favicon: null, title: null, description: null };
    }
  } catch (error) {
    console.warn("Error communicating with content script:", error);
    // Fallback: construct default favicon URL from tab URL
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const urlObj = new URL(tab.url);
        return {
          favicon: `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`,
          title: tab.title || null,
          description: null,
        };
      }
    } catch (fallbackError) {
      console.warn("Fallback favicon extraction failed:", fallbackError);
    }
    return { favicon: null, title: null, description: null };
  }
}

// Handle tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo: TabActiveInfo) => {
  console.log("🔄 Tab activated:", activeInfo.tabId);
  try {
    // Get the active tab
    const tab = await chrome.tabs.get(activeInfo.tabId);
    console.log("📄 Active tab URL:", tab.url);

    // Update session if tab has a valid URL
    if (tab.url) {
      await updateSession(tab.url, activeInfo.tabId);
    }
  } catch (error) {
    console.error("❌ Error handling tab activation:", error);
  }
});

// Handle tab updates (URL changes within a tab)
chrome.tabs.onUpdated.addListener(
  async (tabId: number, changeInfo: TabChangeInfo, tab: chrome.tabs.Tab) => {
    console.log("🔄 Tab updated:", { tabId, changeInfo, url: tab.url });
    try {
      // Only process when URL changes and tab is complete
      if (changeInfo.url && changeInfo.status === "complete") {
        console.log("📍 URL changed to:", tab.url);

        // Update session if it's a valid URL
        if (tab.url) {
          await updateSession(tab.url, tabId);
        }
      }
    } catch (error) {
      console.error("❌ Error handling tab update:", error);
    }
  }
);

// Handle window focus changes (browser losing/gaining focus)
chrome.windows.onFocusChanged.addListener(async (windowId: number) => {
  console.log("🪟 Window focus changed:", windowId);
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus - end current session
      console.log("👋 Browser lost focus, ending session");
      if (currentSession) {
        currentSession.endAt = Date.now();
        const result = await chrome.storage.local.get(["sessions"]);
        const sessions: Session[] = result.sessions || [];
        sessions.push(currentSession);
        await chrome.storage.local.set({ sessions: sessions });
        currentSession = null;
      }
    } else {
      // Browser gained focus - get the active tab and start session
      console.log("👀 Browser gained focus, getting active tab");
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        const tab = tabs[0];
        console.log("📄 Active tab on focus:", tab.url);
        if (tab.url && tab.id) {
          await updateSession(tab.url, tab.id);
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
      if (tab.url && tab.id) {
        await updateSession(tab.url, tab.id);
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
      if (tab.url && tab.id) {
        await updateSession(tab.url, tab.id);
      }
    }
  } catch (error) {
    console.error("Error handling installation:", error);
  }
});

// Handle browser close - try to save current session
chrome.runtime.onSuspend.addListener(async () => {
  if (currentSession) {
    currentSession.endAt = Date.now();
    const result = await chrome.storage.local.get(["sessions"]);
    const sessions: Session[] = result.sessions || [];
    sessions.push(currentSession);
    await chrome.storage.local.set({ sessions: sessions });
    currentSession = null;
  }
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
