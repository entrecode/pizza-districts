import { expect, test } from "@playwright/test";

import { hostnameOf, isJsResource, observeNetwork } from "../src/cdp-network";
import { isMapsHost } from "../src/budgets";

test("play map runtime is user-activated (no Maps JS before tap)", async ({ page }) => {
  const observer = await observeNetwork(page);

  const response = await page.goto("/play", { waitUntil: "domcontentloaded" });
  expect(response, "/play returned a response").not.toBeNull();
  expect(response!.ok(), `/play status was ${response!.status()}`).toBeTruthy();

  await observer.waitForIdle(1200, 15_000);

  const hasLoadButton = (await page.getByRole("button", { name: "Load district map" }).count()) > 0;
  const hasOfflineBanner =
    (await page.getByText("Map offline").count()) > 0 ||
    (await page.getByText("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY").count()) > 0;

  if (!hasLoadButton && hasOfflineBanner) {
    await observer.detach();
    test.skip(true, "Maps runtime is disabled in this environment.");
  }

  expect(hasLoadButton, "expected map activation button when Maps runtime is enabled").toBeTruthy();

  const mapsJsBeforeClick = observer.records.filter(
    (r) => isMapsHost(hostnameOf(r.url)) && isJsResource(r),
  );
  expect(
    mapsJsBeforeClick.length,
    "Maps JS should not load during initial page load before explicit activation",
  ).toBe(0);

  await page.getByRole("button", { name: "Load district map" }).click();

  const start = Date.now();
  while (Date.now() - start < 12_000) {
    const mapsJsAfterClick = observer.records.filter(
      (r) => isMapsHost(hostnameOf(r.url)) && isJsResource(r),
    );
    if (mapsJsAfterClick.length > 0) break;
    await page.waitForTimeout(250);
  }

  const mapsJsAfterClick = observer.records.filter(
    (r) => isMapsHost(hostnameOf(r.url)) && isJsResource(r),
  );
  expect(mapsJsAfterClick.length, "Maps JS should begin loading after user activation").toBeGreaterThan(
    0,
  );

  await observer.detach();
});
