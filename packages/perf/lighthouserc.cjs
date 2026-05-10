// Lighthouse CI config for the /play perf gate (PIZ-16 / PIZ-91).
//
// Mobile preset (Lighthouse default), 4G + 4× CPU slowdown — same profile
// as the Playwright budget run so the two assertions agree.
//
// The gate fails the build if /play scores under 0.85 on the mobile
// performance category (ADR-0004 §1, PIZ-1 DoD).
//
// Remote Vercel previews: set VERCEL_AUTOMATION_BYPASS_SECRET in the shell (or
// GitHub Actions secret) so LHCI sends x-vercel-protection-bypass + cookie flag
// (see .github/workflows/perf-lighthouse-remote.yml).
//
// IMPORTANT: lhci does NOT start the server. CI starts `next start` before
// invoking lhci so that one server instance feeds both the Playwright and
// Lighthouse runs (saves ~30 s per build). Locally the same is true; set
// PERF_BASE_URL if you're not on http://127.0.0.1:3000.

const baseURL = (process.env.PERF_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/** @type {Record<string, string>} */
const extraHeaders = vercelBypass
  ? {
      "x-vercel-protection-bypass": vercelBypass,
      // Persist bypass for redirects / subresource loads (Vercel automation bypass).
      "x-vercel-set-bypass-cookie": "true",
    }
  : {};

module.exports = {
  ci: {
    collect: {
      url: [`${baseURL}/play`],
      // PIZ-91: worst-of-3 on preview; PR gate uses the same profile.
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 2,
          disabled: false,
        },
        throttlingMethod: "simulate",
        // Skip PWA/SEO/a11y/best-practices for the gate — performance is
        // the only category we promise on this issue. Other categories will
        // get their own gates if/when they become DoD lines.
        onlyCategories: ["performance"],
        // Don't look at storage warnings on a fresh skeleton.
        skipAudits: ["uses-http2"],
        ...(Object.keys(extraHeaders).length > 0 ? { extraHeaders } : {}),
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./lhci-output",
      reportFilenamePattern: "lhci-%%PATHNAME%%-%%DATETIME%%.html",
    },
  },
};
