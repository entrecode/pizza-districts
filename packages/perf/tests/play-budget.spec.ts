import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

import { PERF_BUDGETS, KB, ceilingOf, isMapsHost } from "../src/budgets";
import { observeNetwork, isJsResource, hostnameOf, type NetworkRecord } from "../src/cdp-network";
import { applyMobileThrottle } from "../src/throttle";

// Phase 1 perf-budget gate (PIZ-16). Enforces ADR-0004 §1 on /play.
//
// The test loads /play in mobile-emulation Chromium under a 4G + 4× CPU
// slowdown profile, captures CDP-encoded transferSize for every response,
// then asserts:
//   - own-route JS payload (excl. Maps) ≤ 180 KB gz × (1 + slack)
//   - total Maps JS payload ≤ 280 KB gz × (1 + slack), if Maps is present
//   - first-paint-after-Maps ≤ 2.5 s × (1 + slack), if Maps is present
//
// Maps assertions are skipped when no Maps JS loads (e.g. CI placeholders or
// `mapsRuntimeEnabled()` false). They run automatically once real browser keys +
// cloud `mapId` bootstrap the SDK — see [PIZ-17](/PIZ/issues/PIZ-17).

type BudgetReport = {
  url: string;
  capturedAt: string;
  budgets: typeof PERF_BUDGETS & { failSlack: number };
  measured: {
    ownJsBytes: number;
    ownJsKB: number;
    mapsJsBytes: number;
    mapsJsKB: number;
    totalEncodedBytes: number;
    requestsObserved: number;
    mapsRequestsObserved: number;
    firstMapPaintMs: number | null;
  };
  status: "pass" | "warn" | "fail";
  notes: string[];
  perResource: Array<{
    url: string;
    host: string;
    resourceType: string;
    mimeType: string;
    encodedBytes: number;
  }>;
};

test("perf-budget gate: /play stays inside ADR-0004 §1 budgets", async ({ page }, testInfo) => {
  const observer = await observeNetwork(page);
  await applyMobileThrottle(observer.cdp);

  const navStart = Date.now();
  const response = await page.goto("/play", { waitUntil: "domcontentloaded" });
  expect(response, "/play returned a response").not.toBeNull();
  expect(response!.ok(), `/play status was ${response!.status()}`).toBeTruthy();

  // Drain late-firing requests (Maps loaders fire after first-paint).
  await observer.waitForIdle(1500, 20_000);
  await observer.detach();

  const records = observer.records;

  // First paint after Maps script request — best-effort. We approximate
  // "first map paint" as: timestamp of the first paint entry observed AFTER
  // the earliest Maps request started. Use Performance API in-page.
  const paintTimings = await page.evaluate(() => {
    return performance.getEntriesByType("paint").map((e) => ({
      name: e.name,
      // startTime is ms from navigationStart
      startTime: e.startTime,
    }));
  });

  const mapsRecords = records.filter((r) => isMapsHost(hostnameOf(r.url)) && isJsResource(r));
  const ownJsRecords = records.filter((r) => isJsResource(r) && !isMapsHost(hostnameOf(r.url)));

  const ownJsBytes = sum(ownJsRecords);
  const mapsJsBytes = sum(mapsRecords);

  const earliestMapsStart = mapsRecords.length
    ? Math.min(...mapsRecords.map((r) => r.startedAt))
    : null;
  // Convert paint timings (relative to navigationStart) to absolute ms.
  // navStart is approximated by the first request startedAt of any record;
  // good enough for Phase 1 reporting (the lhci run is the authoritative
  // first-paint signal for the score gate).
  const firstPaintAfterMaps =
    earliestMapsStart != null && paintTimings.length
      ? (paintTimings
          .map((t) => navStart + t.startTime)
          .filter((abs) => abs >= earliestMapsStart)
          .sort((a, b) => a - b)[0] ?? null)
      : null;
  const firstMapPaintMs =
    firstPaintAfterMaps != null && earliestMapsStart != null
      ? firstPaintAfterMaps - navStart
      : null;

  const ceilings = {
    ownJs: ceilingOf(PERF_BUDGETS.ownJsGzKB) * KB,
    mapsJs: ceilingOf(PERF_BUDGETS.mapsJsGzKB) * KB,
    firstMapPaintMs: ceilingOf(PERF_BUDGETS.firstMapPaintMs),
  };

  const notes: string[] = [];
  let status: BudgetReport["status"] = "pass";

  if (mapsRecords.length === 0) {
    notes.push(
      "No Maps JS requests observed. Skipping Maps payload + first-map-paint assertions (Maps bootstrap inactive or blocked).",
    );
  }
  if (ownJsBytes > PERF_BUDGETS.ownJsGzKB * KB && ownJsBytes <= ceilings.ownJs) {
    status = "warn";
    notes.push(
      `Own JS ${(ownJsBytes / KB).toFixed(1)} KB > budget ${PERF_BUDGETS.ownJsGzKB} KB but within +${(ceilingOf(0) - 1) * 100}% slack.`,
    );
  }

  const report: BudgetReport = {
    url: "/play",
    capturedAt: new Date().toISOString(),
    budgets: { ...PERF_BUDGETS, failSlack: 0.1 },
    measured: {
      ownJsBytes,
      ownJsKB: roundKB(ownJsBytes),
      mapsJsBytes,
      mapsJsKB: roundKB(mapsJsBytes),
      totalEncodedBytes: sum(records),
      requestsObserved: records.length,
      mapsRequestsObserved: mapsRecords.length,
      firstMapPaintMs,
    },
    status,
    notes,
    perResource: records.map((r) => ({
      url: r.url,
      host: hostnameOf(r.url),
      resourceType: r.resourceType,
      mimeType: r.mimeType,
      encodedBytes: r.encodedBytes,
    })),
  };

  // Persist to artifact dir BEFORE asserting so failures still publish a
  // human-readable report alongside the trace.
  const reportDir = path.resolve("playwright-report");
  await mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "budget-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  await testInfo.attach("budget-report.json", {
    contentType: "application/json",
    path: reportPath,
  });

  // Console summary makes CI logs immediately useful without opening the
  // attachment.
  console.log(
    [
      "",
      "──────────── /play perf-budget summary ────────────",
      `Own JS:   ${report.measured.ownJsKB.toFixed(1)} KB gz  (budget ${PERF_BUDGETS.ownJsGzKB}, ceiling ${(ceilings.ownJs / KB).toFixed(1)})`,
      `Maps JS:  ${report.measured.mapsJsKB.toFixed(1)} KB gz  (budget ${PERF_BUDGETS.mapsJsGzKB}, ceiling ${(ceilings.mapsJs / KB).toFixed(1)})`,
      `First map paint: ${firstMapPaintMs != null ? firstMapPaintMs.toFixed(0) + " ms" : "not measured"}  (budget ${PERF_BUDGETS.firstMapPaintMs} ms, ceiling ${ceilings.firstMapPaintMs.toFixed(0)} ms)`,
      `Maps requests: ${mapsRecords.length}  Total requests: ${records.length}`,
      ...notes.map((n) => `note: ${n}`),
      "───────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );

  // Hard assertions.
  expect(
    ownJsBytes,
    `own /play JS payload exceeded ceiling ${(ceilings.ownJs / KB).toFixed(1)} KB gz`,
  ).toBeLessThanOrEqual(ceilings.ownJs);

  if (mapsRecords.length > 0) {
    expect(
      mapsJsBytes,
      `Maps JS payload exceeded ceiling ${(ceilings.mapsJs / KB).toFixed(1)} KB gz`,
    ).toBeLessThanOrEqual(ceilings.mapsJs);

    if (firstMapPaintMs != null) {
      expect(
        firstMapPaintMs,
        `first map paint exceeded ceiling ${ceilings.firstMapPaintMs.toFixed(0)} ms`,
      ).toBeLessThanOrEqual(ceilings.firstMapPaintMs);
    }
  }
});

function sum(records: NetworkRecord[]): number {
  return records.reduce((acc, r) => acc + (r.encodedBytes ?? 0), 0);
}

function roundKB(bytes: number): number {
  return Math.round((bytes / KB) * 10) / 10;
}
