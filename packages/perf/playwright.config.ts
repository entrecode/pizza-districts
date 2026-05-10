import { defineConfig, devices } from "@playwright/test";

// Phase 1 perf-budget gate (PIZ-16). Mobile-emulation Playwright runner that
// loads /play from a production server and asserts ADR-0004 §1 budgets.
//
// The dev server is intentionally NOT used: Next dev injects HMR + an
// overlay that distort transferSize and Lighthouse scores. The gate always
// runs against `next start`. CI brings up the server itself (the `cwd`
// resolution from a workspace package was awkward); locally, set
// PERF_USE_RUNNING_SERVER=1 to skip auto-start and reuse a running server.

const baseURL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000";
const useRunningServer = process.env.PERF_USE_RUNNING_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["html", { outputFolder: "playwright-report/html", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    // ADR-0004 §1 baseline device: 375×812 (iPhone-class) emulation. We use
    // Playwright's "Pixel 5" descriptor for UA + touch + DPR but pin the
    // viewport to the spec width so budgets match the audit target exactly.
    ...devices["Pixel 5"],
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  projects: [{ name: "mobile-chrome", use: { browserName: "chromium" } }],
  webServer: useRunningServer
    ? undefined
    : {
        // Resolved from this config's cwd (packages/perf). The web app is the
        // start target; we reuse the workspace-level pnpm command so the same
        // binary lookup works in CI and locally.
        command: "pnpm --filter @pd/web start",
        cwd: "../..",
        url: `${baseURL}/play`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
