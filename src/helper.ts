// Helper function to extract domain from URL
export function extractDomain(url: string): string | null {
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
export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}
