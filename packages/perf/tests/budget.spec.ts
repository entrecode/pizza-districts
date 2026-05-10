import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  BUDGET_TOLERANCE,
  FIRST_MAP_PAINT_BUDGET_MS,
  MAPS_JS_BUDGET_BYTES_GZ,
  mapsRuntimeEnabled,
} from "../src/maps-runtime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../playwright-report/budget-report.json");

const MAPS_HOST_RE = /maps\.googleapis\.com|maps\.gstatic\.com/;

function writeReport(data: Record<string, unknown>) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

test.describe("PIZ-73 /play perf budget", () => {
  test("maps ceilings when runtime enabled; skipped notes otherwise", async ({ page }) => {
    const mapsOn = mapsRuntimeEnabled();
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

    let firstMapPaintMs: number | null = null;
    let mapsRequestsObserved = 0;
    let mapsJsBytes = 0;
    let measurement: "resource-timing-encoded" | "response-body-fallback" = "resource-timing-encoded";
    const notes: string[] = [];

    if (mapsOn) {
      await page.waitForFunction(
        () => typeof (window as Window & { __PD_MAP_READY_MS?: number }).__PD_MAP_READY_MS === "number",
        { timeout: 90_000 },
      );
      await page.waitForTimeout(2500);

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
    } else {
      await page.waitForLoadState("networkidle").catch(() => {});
      notes.push("skipped — no Maps requests observed (Maps runtime disabled / ci-placeholder keys)");
      firstMapPaintMs = null;
      mapsRequestsObserved = 0;
      mapsJsBytes = 0;
    }

    writeReport({
      mapsRuntimeEnabled: mapsOn,
      mapsRequestsObserved,
      mapsJsBytes,
      firstMapPaintMs,
      measurement: mapsOn ? measurement : "n/a",
      notes,
      budgets: {
        mapsJsBytesGzMax: Math.floor(MAPS_JS_BUDGET_BYTES_GZ * BUDGET_TOLERANCE),
        firstMapPaintMsMax: Math.floor(FIRST_MAP_PAINT_BUDGET_MS * BUDGET_TOLERANCE),
      },
    });
  });
});
