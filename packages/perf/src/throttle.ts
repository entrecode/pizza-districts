// CDP-driven mobile throttling: applies the network + CPU profile we audit
// against. Keep this in lockstep with ADR-0004 §1 — Pixel 5 baseline, 4G.
//
// The numbers below match Lighthouse's "Mobile" preset so the Playwright
// budget run and the lhci run see comparable conditions, even though they
// run in separate Chromium processes.

import type { CDPSession } from "@playwright/test";

// Lighthouse mobile preset: 4G profile (RTT ~150ms, throughput ~1.6 Mbit/s
// down, 750 Kbit/s up). Slightly slower than fast 4G — what we promised in
// the ADR.
const NETWORK = {
  offline: false,
  latencyMs: 150,
  downloadThroughputBytesPerSecond: (1.6 * 1024 * 1024) / 8, // ~205 KB/s
  uploadThroughputBytesPerSecond: (750 * 1024) / 8, // ~94 KB/s
};

// Pixel 5-class throttling. Lighthouse uses 4× CPU slowdown for mobile; we
// match.
const CPU_SLOWDOWN = 4;

export async function applyMobileThrottle(cdp: CDPSession): Promise<void> {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: NETWORK.offline,
    latency: NETWORK.latencyMs,
    downloadThroughput: NETWORK.downloadThroughputBytesPerSecond,
    uploadThroughput: NETWORK.uploadThroughputBytesPerSecond,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}
