import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pizSim from "./packages/eslint-plugin-piz-sim/src/index.js";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "**/next-env.d.ts",
      "packages/perf/lighthouserc.cjs",
      // Auto-generated LUTs: PIZ-35 emits these from generate-luts.mjs and
      // they're already verified by the lock-file CI gate (`check-luts`).
      "packages/sim/src/lut/exp_clamped_q12.ts",
      "packages/sim/src/lut/one_minus_exp_neg_q16.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node-flavored globals used by harness scripts and engine code.
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  // ADR-0001 §7 — admin and game route trees must not import from each other.
  // Tightened on PIZ-8 per CEO acceptance on PIZ-4: enforce now, do not wait
  // for the first violation. The `(group)` parens are the App Router route
  // group syntax; we forbid both bare and parenthesized forms.
  {
    files: ["apps/web/app/(game)/**/*.{ts,tsx}", "apps/web/app/_/(game)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/(admin)/**", "**/app/(admin)/**"],
              message: "Game routes must not import admin code (ADR-0001 §7).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/app/(admin)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/(game)/**", "**/app/(game)/**"],
              message: "Admin routes must not import game code (ADR-0001 §7).",
            },
          ],
        },
      ],
    },
  },
  // PIZ-36 — determinism-harness §7 / ADR-0003 §4.1 banned-API list.
  // Enforced as `error` for the engine's reducer source. The build-time
  // LUT generator (packages/sim/scripts/**) is allowlisted because it
  // legitimately needs Math.exp to emit the precomputed tables.
  {
    files: ["packages/sim/src/**/*.{ts,tsx,js,mjs,cjs}"],
    plugins: { "@piz/sim": pizSim },
    rules: {
      "@piz/sim/no-nondeterministic": "error",
    },
  },
  // Tests live next to source as *.test.ts; harness/fixture code can spin its
  // own seeds and clock, so don't enforce there.
  {
    files: ["packages/sim/src/**/*.test.{ts,tsx,js,mjs}"],
    rules: { "@piz/sim/no-nondeterministic": "off" },
  },
);
