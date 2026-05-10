const baseURL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000";

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
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
