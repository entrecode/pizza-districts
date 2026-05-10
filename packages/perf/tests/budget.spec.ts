import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  BUDGET_TOLERANCE,
  FIRST_MAP_PAINT_BUDGET_MS,
  MAPS_JS_BUDGET_BYTES_GZ,
  mapsRuntimeEnabled,
} from "../src/maps-runtime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../playwright-report/budget-report.json");

const MAPS_HOST_RE = /maps\.googleapis\.com|maps\.gstatic\.com/;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function writeReport(data: Record<string, unknown>) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Prefer browser-observed map bootstrap over Node env — Next inlines NEXT_PUBLIC_* at build time. */
async function waitForMapsBootstrap(page: Page): Promise<"ready" | "disabled"> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const text = document.body?.innerText ?? "";
      return {
        readyMs: (window as Window & { __PD_MAP_READY_MS?: number }).__PD_MAP_READY_MS,
        keysHint: text.includes(
          "Set NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY and NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID",
        ),
        initFailed: text.includes("Could not initialize the map"),
      };
    });

    if (typeof state.readyMs === "number") {
      return "ready";
    }
    if (state.initFailed) {
      throw new Error(
        "MapShell reported init failure (check browser key restrictions / mapId / network). See MapShell hint on /play.",
      );
    }
    if (state.keysHint) {
      return "disabled";
    }
    await sleep(250);
  }
  throw new Error(
    "Timed out waiting for Maps (no __PD_MAP_READY_MS and no missing-key hint — check PERF_GATE, auth, and /play load).",
  );
}

test.describe("PIZ-73 /play perf budget", () => {
  test("maps ceilings when runtime enabled; skipped notes otherwise", async ({ page }) => {
    const envMapsConfigured = mapsRuntimeEnabled();
    const mapsBodies: number[] = [];

    page.on("response", (res) => {
      const u = res.url();
      if (!MAPS_HOST_RE.test(u)) {
        return;
      }
      void res
        .body()
        .then((buf) => {
          mapsBodies.push(buf.length);
        })
        .catch(() => {});
    });

    await page.goto("/play?parcel=demo-parcel", { waitUntil: "domcontentloaded" });
    await page.getByRole("region", { name: "District map" }).waitFor({ state: "visible" });

    let firstMapPaintMs: number | null = null;
    let mapsRequestsObserved = 0;
    let mapsJsBytes = 0;
    let measurement: "resource-timing-encoded" | "response-body-fallback" | "n/a" = "n/a";
    const notes: string[] = [];

    const bootstrap = await waitForMapsBootstrap(page);

    if (bootstrap === "ready") {
      await sleep(2500);

      firstMapPaintMs = await page.evaluate(() => {
        const w = window as Window & { __PD_MAP_READY_MS?: number };
        return w.__PD_MAP_READY_MS ?? null;
      });

      const timing = await page.evaluate(() => {
        const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        let encoded = 0;
        let count = 0;
        for (const e of entries) {
          if (!MAPS_HOST_RE.test(e.name)) {
            continue;
          }
          count++;
          encoded += e.encodedBodySize || 0;
        }
        return { count, encodedBodyBytes: encoded };
      });

      mapsRequestsObserved = timing.count;
      mapsJsBytes = timing.encodedBodyBytes;
      measurement = "resource-timing-encoded";

      if (mapsJsBytes === 0 && mapsBodies.length > 0) {
        measurement = "response-body-fallback";
        mapsJsBytes = mapsBodies.reduce((a, b) => a + b, 0);
        mapsRequestsObserved = Math.max(mapsRequestsObserved, mapsBodies.length);
        notes.push(
          "mapsJsBytes used response-body fallback (encodedBodySize unavailable for some cross-origin responses)",
        );
      }

      const maxJs = Math.floor(MAPS_JS_BUDGET_BYTES_GZ * BUDGET_TOLERANCE);
      const maxPaint = Math.floor(FIRST_MAP_PAINT_BUDGET_MS * BUDGET_TOLERANCE);

      expect(mapsRequestsObserved, "mapsRequestsObserved").toBeGreaterThan(0);
      expect(mapsJsBytes, "mapsJsBytes gz budget").toBeLessThanOrEqual(maxJs);
      expect(firstMapPaintMs, "firstMapPaintMs").not.toBeNull();
      expect(firstMapPaintMs!, "firstMapPaintMs budget").toBeLessThanOrEqual(maxPaint);

      if (!envMapsConfigured) {
        notes.push(
          "Maps bootstrapped in browser but Playwright process lacked non-placeholder NEXT_PUBLIC_GOOGLE_MAPS_* — assertions used browser signal only (build had real inlined keys).",
        );
      }
    } else {
      await page.waitForLoadState("networkidle").catch(() => {});
      notes.push(
        "skipped — no Maps requests observed (MapShell missing-key hint: build has no browser key + map id)",
      );
      if (envMapsConfigured) {
        notes.push(
          "Playwright env had non-placeholder NEXT_PUBLIC_GOOGLE_MAPS_* but the running build did not load Maps — rebuild web with the same keys you export for the perf run.",
        );
      }
      firstMapPaintMs = null;
      mapsRequestsObserved = 0;
      mapsJsBytes = 0;
    }

    writeReport({
      mapsRuntimeEnabledEnv: envMapsConfigured,
      mapsBootstrapObserved: bootstrap,
      mapsRequestsObserved,
      mapsJsBytes,
      firstMapPaintMs,
      measurement: bootstrap === "ready" ? measurement : "n/a",
      notes,
      budgets: {
        mapsJsBytesGzMax: Math.floor(MAPS_JS_BUDGET_BYTES_GZ * BUDGET_TOLERANCE),
        firstMapPaintMsMax: Math.floor(FIRST_MAP_PAINT_BUDGET_MS * BUDGET_TOLERANCE),
      },
    });
  });
});
