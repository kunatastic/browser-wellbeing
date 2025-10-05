/// <reference types="chrome-types" />
// Background script for tracking website visits and time spent

let currentSession: Session | null = null;
let sessionBatch: Session[] = [];
let lastStorageUpdate = 0;
const STORAGE_BATCH_DELAY = 2000; // 2 seconds
const MAX_SESSIONS = 1000; // Limit sessions to prevent memory issues

// Optimized storage functions
async function batchSaveSessions(): Promise<void> {
  if (sessionBatch.length === 0) return;

  try {
    const result = await chrome.storage.local.get(["sessions"]);
    const existingSessions: Session[] = result.sessions || [];

    // Merge with existing sessions and limit total
    const allSessions = [...existingSessions, ...sessionBatch];
    const limitedSessions = allSessions.slice(-MAX_SESSIONS);

    await chrome.storage.local.set({ sessions: limitedSessions });
    sessionBatch = [];
    lastStorageUpdate = Date.now();
  } catch (error) {
    console.error("❌ Error batch saving sessions:", error);
  }
}

// Debounced storage update
function scheduleStorageUpdate(): void {
  const now = Date.now();
  if (now - lastStorageUpdate > STORAGE_BATCH_DELAY) {
    batchSaveSessions();
  } else {
    setTimeout(batchSaveSessions, STORAGE_BATCH_DELAY - (now - lastStorageUpdate));
  }
}

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
    return;
  }

  const currentTime = Date.now();

  try {
    // If there's a current session, add it to batch
    if (currentSession) {
      currentSession.endAt = currentTime;
      sessionBatch.push(currentSession);
    }

    // Get page metadata (favicon, title, description) from content script
    const pageMetadata = await getPageMetadata(tabId);

    // Start new session
    currentSession = {
      domain: domain,
      startAt: currentTime,
      tabId: tabId,
      favicon: pageMetadata.favicon || undefined,
    };

    // Schedule batched storage update
    scheduleStorageUpdate();
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
  try {
    // Get the active tab
    const tab = await chrome.tabs.get(activeInfo.tabId);

    // Update session if tab has a valid URL (fullscreen mode is tracked as usage)
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
    try {
      // Only process when URL changes and tab is complete
      if (changeInfo.url && changeInfo.status === "complete") {
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
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus - end current session
      if (currentSession) {
        currentSession.endAt = Date.now();
        sessionBatch.push(currentSession);
        currentSession = null;
        scheduleStorageUpdate();
      }
    } else {
      // Browser gained focus - get the active tab and start session
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        const tab = tabs[0];
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
    sessionBatch.push(currentSession);
    currentSession = null;
  }
  // Force save any pending sessions
  await batchSaveSessions();
});
