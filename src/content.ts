/// <reference types="chrome-types" />

// Content script for extracting page metadata
// This runs in the context of web pages and can access DOM elements

interface PageMetadata {
  favicon: string | null;
  title: string | null;
  description: string | null;
}

// Function to extract favicon from various sources
function extractFavicon(): string | null {
  const faviconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="mask-icon"]',
    'link[rel="fluid-icon"]',
  ];

  for (const selector of faviconSelectors) {
    const link = document.querySelector(selector) as HTMLLinkElement;
    if (link && link.href) {
      // Convert relative URLs to absolute URLs
      try {
        return new URL(link.href, window.location.href).href;
      } catch (error) {
        console.warn("Invalid favicon URL:", link.href);
      }
    }
  }

  // Fallback to default favicon.ico
  return `${window.location.protocol}//${window.location.hostname}/favicon.ico`;
}

// Function to extract page title
function extractTitle(): string | null {
  return document.title || null;
}

// Function to extract meta description
function extractDescription(): string | null {
  const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
  return metaDescription?.content || null;
}

// Main function to extract all page metadata
function extractPageMetadata(): PageMetadata {
  return {
    favicon: extractFavicon(),
    title: extractTitle(),
    description: extractDescription(),
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(
  (request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
    if (request.action === "extractMetadata") {
      try {
        const metadata = extractPageMetadata();
        sendResponse({ success: true, metadata });
      } catch (error) {
        console.error("Error extracting page metadata:", error);
        sendResponse({ success: false, error: (error as Error).message });
      }
      return true; // Keep the message channel open for async response
    }
    return false;
  }
);

// Automatically send metadata when page loads (optional)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const metadata = extractPageMetadata();
    chrome.runtime.sendMessage({
      action: "pageMetadataReady",
      metadata,
    });
  });
} else {
  // Page already loaded
  const metadata = extractPageMetadata();
  chrome.runtime.sendMessage({
    action: "pageMetadataReady",
    metadata,
  });
}
