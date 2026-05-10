const baseURL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000";
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
      numberOfRuns: 3,
      url: [`${baseURL.replace(/\/$/, "")}/play`],
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 2,
          disabled: false,
        },
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
    },
  },
};
