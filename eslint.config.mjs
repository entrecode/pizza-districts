import js from "@eslint/js";
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
      globals: {
        // Node-flavored globals used by harness scripts and engine code.
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
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
);
