import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.{test,spec}.{ts,tsx}", "apps/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      // Playwright perf gates run via `pnpm --filter @pd/perf test:*`, not Vitest.
      "packages/perf/tests/**",
    ],
    environment: "node",
    passWithNoTests: false,
  },
});
