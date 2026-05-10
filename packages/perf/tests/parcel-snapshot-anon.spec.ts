import { test, expect } from "@playwright/test";

// [PIZ-17](/PIZ/issues/PIZ-17) — anonymized POI boundary. These strings mimic raw
// Places `name` values from a server-side fixture; they must never appear in the
// browser payload or /play DOM.
const RAW_GOOGLE_FIXTURE_NAMES = [`Tony's Slice House SF`, "Google SF Campus Cafe"];

test("parcel snapshot JSON never echoes raw Google fixture names", async ({ request }) => {
  const res = await request.get("/api/places/parcel/phase1-demo/snapshot");
  expect(res.ok(), `snapshot status ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const haystack = JSON.stringify(body);
  for (const name of RAW_GOOGLE_FIXTURE_NAMES) {
    expect(haystack.includes(name), `leaked raw name: ${name}`).toBe(false);
  }
  expect(Array.isArray(body.pois)).toBeTruthy();
});

test("/play DOM never contains raw Google fixture names (anonymized map shell)", async ({
  page,
}) => {
  await page.goto("/play", { waitUntil: "domcontentloaded" });
  const text = await page.evaluate(() => document.body.innerText);
  for (const name of RAW_GOOGLE_FIXTURE_NAMES) {
    expect(text.includes(name), `leaked raw name into DOM: ${name}`).toBe(false);
  }
});
