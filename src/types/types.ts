interface Session {
  domain: string;
  startAt: number;
  endAt?: number;
  tabId: number;
  favicon?: string;
}

interface TabActiveInfo {
  tabId: number;
  windowId: number;
}

interface TabChangeInfo {
  url: string;
  status: string;
}

interface DomainStats {
  time: number;
  sessions: number;
  domain: string;
  favicon?: string;
  title?: string;
  description?: string;
}

interface ProcessedSessions {
  domainStats: Record<string, DomainStats>;
  totalTime: number;
}
