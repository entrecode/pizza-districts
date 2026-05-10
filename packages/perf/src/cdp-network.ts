// CDP-based network observer that records encoded (= bytes-on-wire) sizes
// for every response on a page. Playwright's request.sizes() returns the
// decoded body size, which inflates gzip budgets ~3×. We need the real
// transferSize as it appears in DevTools, so we go straight to CDP.

import type { CDPSession, Page } from "@playwright/test";

export type NetworkRecord = {
  requestId: string;
  url: string;
  resourceType: string;
  method: string;
  status: number;
  mimeType: string;
  encodedBytes: number; // bytes on wire including headers (per CDP)
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  startedAt: number; // Date.now() at request start
  finishedAt: number | null;
};

export type NetworkObserver = {
  cdp: CDPSession;
  records: NetworkRecord[];
  waitForIdle: (idleMs?: number, hardTimeoutMs?: number) => Promise<void>;
  detach: () => Promise<void>;
};

export async function observeNetwork(page: Page): Promise<NetworkObserver> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");

  const records: NetworkRecord[] = [];
  const byId = new Map<string, NetworkRecord>();
  let lastEventAt = Date.now();

  cdp.on("Network.requestWillBeSent", (e) => {
    lastEventAt = Date.now();
    const rec: NetworkRecord = {
      requestId: e.requestId,
      url: e.request.url,
      resourceType: e.type ?? "Other",
      method: e.request.method,
      status: 0,
      mimeType: "",
      encodedBytes: 0,
      fromDiskCache: false,
      fromServiceWorker: false,
      startedAt: Date.now(),
      finishedAt: null,
    };
    byId.set(e.requestId, rec);
    records.push(rec);
  });

  cdp.on("Network.responseReceived", (e) => {
    lastEventAt = Date.now();
    const rec = byId.get(e.requestId);
    if (!rec) return;
    rec.url = e.response.url;
    rec.status = e.response.status;
    rec.mimeType = e.response.mimeType;
    rec.fromDiskCache = Boolean(e.response.fromDiskCache);
    rec.fromServiceWorker = Boolean(e.response.fromServiceWorker);
    rec.resourceType = e.type ?? rec.resourceType;
    // headers contribute to wire bytes; CDP gives us encodedDataLength on
    // loadingFinished, which already includes them. Don't double-count.
  });

  cdp.on("Network.loadingFinished", (e) => {
    lastEventAt = Date.now();
    const rec = byId.get(e.requestId);
    if (!rec) return;
    rec.encodedBytes = e.encodedDataLength ?? 0;
    rec.finishedAt = Date.now();
  });

  cdp.on("Network.loadingFailed", (e) => {
    lastEventAt = Date.now();
    const rec = byId.get(e.requestId);
    if (!rec) return;
    rec.finishedAt = Date.now();
  });

  // "Network is quiet" wait: no Network.* events for `idleMs`, capped at
  // `hardTimeoutMs`. This is more reliable than load events when third-party
  // (Maps) scripts are in the mix because they tend to fire requests after
  // domcontentloaded.
  async function waitForIdle(idleMs = 1500, hardTimeoutMs = 30_000) {
    const start = Date.now();
    while (Date.now() - start < hardTimeoutMs) {
      const sinceLast = Date.now() - lastEventAt;
      if (sinceLast >= idleMs) return;
      await new Promise((r) => setTimeout(r, Math.max(50, idleMs - sinceLast)));
    }
  }

  return {
    cdp,
    records,
    waitForIdle,
    detach: async () => {
      try {
        await cdp.detach();
      } catch {
        // session may already be torn down — fine
      }
    },
  };
}

export function totalEncodedBytes(records: NetworkRecord[]): number {
  return records.reduce((sum, r) => sum + (r.encodedBytes ?? 0), 0);
}

export function isJsResource(rec: NetworkRecord): boolean {
  if (rec.resourceType === "Script") return true;
  // Some Maps responses come back as text/javascript or application/javascript
  // tagged with type "Other"; keep the script filter inclusive.
  return /javascript|ecmascript/i.test(rec.mimeType);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
