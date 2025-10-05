// Popup script for displaying website usage statistics

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

// Helper function to format time in milliseconds to readable format
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to get today's date string
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// Helper function to check if a timestamp is from today
function isToday(timestamp) {
  const today = new Date().toISOString().split("T")[0];
  const date = new Date(timestamp).toISOString().split("T")[0];
  return date === today;
}

// Process sessions and group by domain
function processSessions(sessions) {
  const domainStats = {};
  let totalTime = 0;
  let todaySessions = 0;
  let skippedSessions = 0;

  console.log("🔄 Processing sessions...");

  sessions.forEach((session, index) => {
    console.log(`📋 Processing session ${index + 1}:`, {
      url: session.url,
      start: new Date(session.start_time).toLocaleString(),
      end: session.end_time ? new Date(session.end_time).toLocaleString() : "ongoing",
      isToday: isToday(session.start_time),
    });

    // Only process sessions from today
    if (!isToday(session.start_time)) {
      console.log("⏭️ Skipping session (not today)");
      return;
    }

    // Skip sessions without end_time (ongoing sessions)
    if (!session.end_time) {
      console.log("⏭️ Skipping ongoing session");
      skippedSessions++;
      return;
    }

    const domain = extractDomain(session.url);
    if (!domain) {
      console.log("⏭️ Skipping session (invalid domain)");
      return;
    }

    const sessionTime = session.end_time - session.start_time;
    console.log(`⏱️ Session time: ${Math.round(sessionTime / 1000)}s for ${domain}`);

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

  console.log(
    `📊 Processing complete: ${todaySessions} today's sessions, ${skippedSessions} skipped`
  );
  return { domainStats, totalTime };
}

// Render the domain list
function renderDomainList(domainStats, totalTime) {
  const content = document.getElementById("content");

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
        ? `<img src="${domain.favicon}" alt="${domain.domain}" class="domain-favicon" onerror="this.style.display='none'">`
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
}

// Update total time display
function updateTotalTime(totalTime) {
  const totalTimeElement = document.getElementById("totalTime");
  totalTimeElement.textContent = formatTime(totalTime);
}

// Main function to load and display data
async function loadUsageData() {
  console.log("🔄 Loading usage data...");
  try {
    // Check if chrome.storage is available
    if (typeof chrome === "undefined" || !chrome.storage) {
      throw new Error("Chrome storage API not available");
    }

    console.log("✅ Chrome storage API available");

    // Get sessions from storage
    const result = await chrome.storage.local.get(["sessions"]);
    const sessions = result.sessions || [];

    console.log(`📊 Found ${sessions.length} sessions in storage`);
    console.log("📋 Raw sessions data:", sessions);

    // Process sessions
    const { domainStats, totalTime } = processSessions(sessions);

    console.log("📈 Processed data:", {
      domains: Object.keys(domainStats).length,
      totalTime: `${Math.round(totalTime / 1000)}s`,
      domainStats: domainStats,
    });

    // Update UI
    updateTotalTime(totalTime);
    renderDomainList(domainStats, totalTime);

    console.log("✅ UI updated successfully");
  } catch (error) {
    console.error("❌ Error loading usage data:", error);

    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Error loading data</h3>
        <p>There was an error loading your usage data. Please try again.</p>
        <p style="font-size: 12px; margin-top: 10px; color: #999;">Error: ${error.message}</p>
      </div>
    `;
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded - loading usage data");

  // Add a small delay to ensure Chrome APIs are ready
  setTimeout(() => {
    loadUsageData();
  }, 100);
});

// Refresh data when popup is opened (in case data changed)
window.addEventListener("focus", () => {
  loadUsageData();
});
