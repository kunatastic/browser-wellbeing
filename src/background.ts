/// <reference types="chrome-types" />
/**
 * Browser Wellbeing Extension - Background Script
 *
 * This script tracks user's website visits and time spent on each domain.
 * It maintains session data and stores it locally for the popup to display.
 *
 * Key Features:
 * - Tracks active browsing sessions across tabs and windows
 * - Batches storage operations for performance
 * - Handles all browser events (tab changes, window focus, etc.)
 * - Extracts page metadata (favicon, title) for better UX
 */

// ============================================================================
// GLOBAL STATE & CONFIGURATION
// ============================================================================

/** Currently active browsing session */
let currentSession: Session | null = null;
let sessionBatch: Session[] = [];
let lastStorageUpdate = 0;
const STORAGE_BATCH_DELAY = 2000; // 2 seconds
const MAX_SESSIONS = 1000; // Limit sessions to prevent memory issues

// ============================================================================
// STORAGE MANAGEMENT FUNCTIONS
// ============================================================================

// Storage functions
async function batchSaveSessions(): Promise<void> {
  if (sessionBatch.length === 0) return;

  try {
    const result = await chrome.storage.local.get(["sessions"]);
    const existingSessions: Session[] = result.sessions || [];

    // Merge with existing sessions and limit total
    const allSessions = [...existingSessions, ...sessionBatch];
    const limitedSessions = allSessions.slice(-MAX_SESSIONS);

    await chrome.storage.local.set({ sessions: limitedSessions });
    console.log(`💾 Batch saved ${sessionBatch.length} sessions. Total: ${limitedSessions.length}`);
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

// Update session - handles both starting new sessions and updating existing ones
async function updateSession(url: string, tabId: number): Promise<void> {
  const domain = extractDomain(url);
  if (!domain) {
    return;
  }

  const currentTime = Date.now();

  try {
    // Check if we're switching to the same domain - if so, don't update
    if (currentSession && currentSession.domain === domain && currentSession.tabId === tabId) {
      return;
    }

    // If there's a current session, add it to batch
    if (currentSession) {
      const sessionDuration = Math.round((currentTime - currentSession.startAt) / 1000);
      console.log(
        `Session ended: ${currentSession.domain}, duration: ${sessionDuration}s, reason: switching_to_new_session`
      );

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

    console.log(`Session started: ${domain}`);

    // Schedule batched storage update
    scheduleStorageUpdate();
  } catch (error) {
    console.error("❌ Error updating session:", error);
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR EVENT LISTENERS
// ============================================================================

// Helper to safely handle tab-based events
async function handleTabEvent(tabId: number, eventName: string): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.active && tab.url) {
      await updateSession(tab.url, tabId);
    }
  } catch (error) {
    console.error(`❌ Error handling ${eventName}:`, error);
  }
}

// Helper to safely handle tab creation events
async function handleTabCreated(tab: chrome.tabs.Tab, eventName: string): Promise<void> {
  try {
    if (tab.active && tab.url && tab.id) {
      await updateSession(tab.url, tab.id);
    }
  } catch (error) {
    console.error(`❌ Error handling ${eventName}:`, error);
  }
}

// Helper to safely handle active tab queries
async function handleActiveTabQuery(eventName: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (tab.url && tab.id) {
        await updateSession(tab.url, tab.id);
      }
    }
  } catch (error) {
    console.error(`❌ Error handling ${eventName}:`, error);
  }
}

// Helper to end current session with reason
function endCurrentSession(reason: string): void {
  if (currentSession) {
    const sessionDuration = Math.round((Date.now() - currentSession.startAt) / 1000);
    console.log(
      `Session ended: ${currentSession.domain}, duration: ${sessionDuration}s, reason: ${reason}`
    );

    currentSession.endAt = Date.now();
    sessionBatch.push(currentSession);
    currentSession = null;
    scheduleStorageUpdate();
  }
}

// ============================================================================
// BROWSER EVENT LISTENERS
// ============================================================================

// Handle tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo: TabActiveInfo) => {
  await handleTabEvent(activeInfo.tabId, "tab activation");
});

// Handle tab updates (URL changes within a tab)
chrome.tabs.onUpdated.addListener(
  async (tabId: number, changeInfo: TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      await updateSession(tab.url, tabId);
    }
  }
);

// Handle tab creation (new tab opened)
chrome.tabs.onCreated.addListener(async (tab: chrome.tabs.Tab) => {
  await handleTabCreated(tab, "tab creation");
});

// Handle tab movement (tab reordered within window or moved between windows)
chrome.tabs.onMoved.addListener(async (tabId: number, _moveInfo: chrome.tabs.OnMovedInfo) => {
  await handleTabEvent(tabId, "tab movement");
});

// Handle tab detachment (tab moved to different window)
chrome.tabs.onDetached.addListener(
  async (tabId: number, _detachInfo: chrome.tabs.OnDetachedInfo) => {
    await handleTabEvent(tabId, "tab detachment");
  }
);

// Handle tab attachment (tab moved to window)
chrome.tabs.onAttached.addListener(
  async (tabId: number, _attachInfo: chrome.tabs.OnAttachedInfo) => {
    await handleTabEvent(tabId, "tab attachment");
  }
);

// Handle tab removal (tab closed)
chrome.tabs.onRemoved.addListener(async (tabId: number, _removeInfo: chrome.tabs.OnRemovedInfo) => {
  if (currentSession && currentSession.tabId === tabId) {
    endCurrentSession("tab_closed");
  }
});

// Handle tab replacement (tab replaced by another tab, e.g., prerendering)
chrome.tabs.onReplaced.addListener(async (addedTabId: number, _removedTabId: number) => {
  await handleTabEvent(addedTabId, "tab replacement");
});

// ----------------------------------------------------------------------------
// WINDOW EVENTS - Track browser focus and window management
// ----------------------------------------------------------------------------

// Handle window focus changes (browser losing/gaining focus)
chrome.windows.onFocusChanged.addListener(async (windowId: number) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    endCurrentSession("browser_lost_focus");
  } else {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        const tab = tabs[0];
        if (tab.url && tab.id) {
          await updateSession(tab.url, tab.id);
        }
      }
    } catch (error) {
      console.error("❌ Error handling window focus change:", error);
    }
  }
});

// ----------------------------------------------------------------------------
// RUNTIME EVENTS - Handle extension lifecycle and browser startup
// ----------------------------------------------------------------------------

// Handle browser startup - get the active tab
chrome.runtime.onStartup.addListener(async () => {
  await handleActiveTabQuery("startup");
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(async (_details: chrome.runtime.InstalledDetails) => {
  await handleActiveTabQuery("installation");
});

// Handle browser close - try to save current session
chrome.runtime.onSuspend.addListener(async () => {
  endCurrentSession("browser_suspend");
  await batchSaveSessions();
});
