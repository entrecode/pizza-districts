import { defineConfig } from "vitest/config";

// Per-package vitest config so the package-scoped scripts (`pnpm
// --filter @pd/sim-test run test:tier1` and friends) can pass relative
// `test/<name>.test.ts` paths and have them resolved against this
// directory.
export default defineConfig({
  test: {
    include: ["test/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    passWithNoTests: false,
  },
});
