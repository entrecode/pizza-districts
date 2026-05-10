import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

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
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  // Build-time / config files run on Node — give them the Node globals so
  // process / __dirname / Buffer don't trip no-undef. Keeps app/runtime
  // code (browser by default) honest about its imports.
  {
    files: [
      "**/*.config.{js,mjs,cjs,ts}",
      "apps/web/instrumentation.ts",
      "apps/web/sentry.*.config.{ts,js}",
      "scripts/**/*.{js,mjs,cjs,ts}",
    ],
    languageOptions: {
      globals: { ...globals.node },
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
);
