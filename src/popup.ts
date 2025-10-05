/// <reference types="chrome-types" />
// Popup script for displaying website usage statistics

// Helper function to format time in milliseconds to readable format
function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `<span class="time-number">${hours}</span><span class="time-unit">h</span> <span class="time-number">${remainingMinutes}</span><span class="time-unit">m</span>`;
  } else if (minutes > 0) {
    return `<span class="time-number">${minutes}</span><span class="time-unit">m</span>`;
  } else {
    return `<span class="time-number">${seconds}</span><span class="time-unit">s</span>`;
  }
}

// Helper function to check if a timestamp is from today
function isToday(timestamp: number): boolean {
  const today = new Date().toISOString().split("T")[0];
  const date = new Date(timestamp).toISOString().split("T")[0];
  return date === today;
}

// Process sessions and group by domain
function processSessions(sessions: Session[]): ProcessedSessions {
  const domainStats: Record<string, DomainStats> = {};
  let totalTime = 0;
  let todaySessions = 0;
  let skippedSessions = 0;

  sessions.forEach((session) => {
    // Only process sessions from today
    if (!isToday(session.startAt)) {
      return;
    }

    // Skip sessions without endAt (ongoing sessions)
    if (!session.endAt) {
      skippedSessions++;
      return;
    }

    const domain = session.domain;
    if (!domain) {
      return;
    }

    const sessionTime = session.endAt - session.startAt;

    if (domainStats[domain]) {
      domainStats[domain].time += sessionTime;
      domainStats[domain].sessions += 1;
    } else {
      domainStats[domain] = {
        time: sessionTime,
        sessions: 1,
        domain: domain,
        favicon: session.favicon,
      };
    }

    totalTime += sessionTime;
    todaySessions++;
  });

  return { domainStats, totalTime };
}

// Render the domain list
function renderDomainList(domainStats: Record<string, DomainStats>, totalTime: number): void {
  const content = document.getElementById("content");
  if (!content) return;

  if (Object.keys(domainStats).length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">📊</div>
        <h3>No data yet</h3>
        <p>Start browsing websites to see your usage statistics here.</p>
      </div>
    `;
    return;
  }

  // Sort domains by time spent (descending)
  const sortedDomains = Object.values(domainStats).sort((a, b) => b.time - a.time);

  const domainsList = sortedDomains
    .map((domain) => {
      const percentage = totalTime > 0 ? (domain.time / totalTime) * 100 : 0;
      const faviconHtml = domain.favicon
        ? `<img src="${domain.favicon}" alt="${domain.domain}" class="domain-favicon" data-domain="${domain.domain}">`
        : `<div class="domain-favicon-placeholder">🌐</div>`;

      return `
        <div class="domain-item">
          <div class="domain-info">
            <div class="domain-header">
              ${faviconHtml}
              <div class="domain-name">${domain.domain}</div>
            </div>
            <div class="domain-time">${domain.sessions} session${
        domain.sessions > 1 ? "s" : ""
      }</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
          <div class="time-badge">${formatTime(domain.time)}</div>
        </div>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="domains-list">
      ${domainsList}
    </div>
  `;

  // Add event listeners for favicon error handling
  const faviconImages = content.querySelectorAll(".domain-favicon");
  faviconImages.forEach((img) => {
    (img as HTMLImageElement).addEventListener("error", () => {
      (img as HTMLImageElement).style.display = "none";
    });
  });
}

// Update total time display
function updateTotalTime(totalTime: number): void {
  const totalTimeElement = document.getElementById("totalTime");
  if (totalTimeElement) {
    totalTimeElement.innerHTML = formatTime(totalTime);
  }
}

// Helper function to wait for Chrome APIs to be available
async function waitForChromeAPIs(maxRetries: number = 10, delay: number = 100): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

// Main function to load and display data
async function loadUsageData(): Promise<void> {
  try {
    // Wait for Chrome APIs to be available (Arc browser compatibility)
    const apisAvailable = await waitForChromeAPIs();
    if (!apisAvailable) {
      throw new Error("Chrome storage API not available after retries");
    }

    // Get sessions from storage
    const result = await chrome.storage.local.get(["sessions"]);
    const sessions: Session[] = result.sessions || [];

    // Process sessions
    const { domainStats, totalTime } = processSessions(sessions);

    // Update UI
    updateTotalTime(totalTime);
    renderDomainList(domainStats, totalTime);
  } catch (error) {
    console.error("❌ Error loading usage data:", error);

    const content = document.getElementById("content");
    if (content) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <h3>Error loading data</h3>
          <p>There was an error loading your usage data. Please try again.</p>
          <p style="font-size: 12px; margin-top: 10px; color: #999;">Error: ${
            (error as Error).message
          }</p>
          <button id="retryButton" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
        </div>
      `;

      // Add event listener for retry button
      const retryButton = document.getElementById("retryButton");
      if (retryButton) {
        retryButton.addEventListener("click", loadUsageData);
      }
    }
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Add a longer delay for Arc browser compatibility
  setTimeout(() => {
    loadUsageData();
  }, 200);
});

// Refresh data when popup is opened (in case data changed)
window.addEventListener("focus", () => {
  loadUsageData();
});

// Add visibility change listener for better Arc compatibility
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadUsageData();
  }
});
