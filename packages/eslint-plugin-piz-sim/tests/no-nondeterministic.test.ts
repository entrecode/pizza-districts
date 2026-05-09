import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vitest";
import rule from "../src/rules/no-nondeterministic.js";

// ESLint 9's RuleTester needs an explicit describe/it shim when run under
// vitest — the default Mocha-style globals aren't present.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parser: tsParser,
  },
});

tester.run("no-nondeterministic", rule, {
  valid: [
    // Clock — injected `clock` is fine.
    { code: `function step(clock) { return clock.dayIndex + 1; }` },

    // RNG — injected `rng` is fine.
    { code: `function tick(rng) { return rng.nextU32(); }` },

    // Math allowlist (floor/round/abs/min/max/ceil/sign/trunc).
    {
      code: `const a = Math.floor(1.2); const b = Math.round(2.5); const c = Math.abs(-3); const d = Math.min(1,2); const e = Math.max(1,2);`,
    },

    // LUT-backed helpers are fine.
    { code: `import { expClampedQ12 } from "@pd/sim/lut"; const x = expClampedQ12(42);` },

    // Date used purely as a TS type annotation is fine — runtime-erased.
    { code: `let when: Date | null = null;`, languageOptions: { parser: tsParser } },

    // Code-point sort, not localeCompare.
    {
      code: `const sorted = ["b","a"].sort((x,y) => x < y ? -1 : x > y ? 1 : 0);`,
    },

    // Map/Set iteration WITH explicit sort (allowed).
    {
      code: `const arr = [...new Map()].sort(([a],[b]) => a < b ? -1 : 1); for (const x of arr) {}`,
    },
    {
      code: `const arr = Array.from(new Set()).sort((a,b)=>a-b); for (const v of arr) {}`,
    },

    // Integer division is fine.
    { code: `const half = total / 2;` },

    // process used for something other than env (still flagged elsewhere maybe,
    // but the rule only targets process.env).
    { code: `function f(process) { return process; }` },

    // Plain integer literal multiply is fine.
    { code: `const x = 3 * 4 + 7 - 1;` },
  ],

  invalid: [
    // ── Clock ────────────────────────────────────────────────────
    {
      code: `const t = Date.now();`,
      errors: [{ messageId: "bannedClock" }],
    },
    {
      code: `const t = performance.now();`,
      errors: [{ messageId: "bannedClock" }],
    },
    {
      code: `const d = new Date();`,
      errors: [{ messageId: "bannedClock" }],
    },
    {
      code: `const d = Date();`,
      errors: [{ messageId: "bannedClock" }],
    },

    // ── RNG ──────────────────────────────────────────────────────
    {
      code: `const r = Math.random();`,
      errors: [{ messageId: "bannedRng" }],
    },
    {
      code: `const id = crypto.randomUUID();`,
      errors: [{ messageId: "bannedRng" }],
    },
    {
      code: `const buf = new Uint8Array(16); crypto.getRandomValues(buf);`,
      errors: [{ messageId: "bannedRng" }],
    },

    // ── Transcendentals ──────────────────────────────────────────
    { code: `const x = Math.sin(1);`, errors: [{ messageId: "bannedTrans" }] },
    { code: `const x = Math.cos(1);`, errors: [{ messageId: "bannedTrans" }] },
    { code: `const x = Math.tan(1);`, errors: [{ messageId: "bannedTrans" }] },
    { code: `const x = Math.exp(1);`, errors: [{ messageId: "bannedTrans" }] },
    { code: `const x = Math.log(1);`, errors: [{ messageId: "bannedTrans" }] },
    { code: `const x = Math.pow(2,3);`, errors: [{ messageId: "bannedTrans" }] },
    { code: `const x = Math.sqrt(4);`, errors: [{ messageId: "bannedTrans" }] },

    // ── Locale ────────────────────────────────────────────────────
    {
      code: `const fmt = new Intl.DateTimeFormat("en-US");`,
      errors: [{ messageId: "bannedLocale" }],
    },
    {
      code: `const sorted = ["b","a"].sort((a,b) => a.localeCompare(b));`,
      errors: [{ messageId: "bannedLocale" }],
    },
    {
      code: `const s = (1234.5).toLocaleString();`,
      errors: [{ messageId: "bannedLocale" }],
    },

    // ── I/O ───────────────────────────────────────────────────────
    {
      code: `const r = await fetch("/api");`,
      languageOptions: {
        parser: tsParser,
        parserOptions: { ecmaFeatures: { topLevelAwait: true } },
      },
      errors: [{ messageId: "bannedIo" }],
    },
    {
      code: `const v = process.env.FOO;`,
      errors: [{ messageId: "bannedIo" }],
    },
    {
      code: `const v = Deno.env.get("FOO");`,
      errors: [{ messageId: "bannedIo" }],
    },
    {
      code: `const v = import.meta.env.FOO;`,
      errors: [{ messageId: "bannedIo" }],
    },
    {
      code: `import * as fs from "node:fs";`,
      errors: [{ messageId: "bannedIo" }],
    },
    {
      code: `import { connect } from "node:net";`,
      errors: [{ messageId: "bannedIo" }],
    },
    {
      code: `import * as fs from "fs";`,
      errors: [{ messageId: "bannedIo" }],
    },

    // ── Map/Set iteration heuristic ───────────────────────────────
    {
      code: `for (const [k,v] of new Map()) { /* ... */ }`,
      errors: [{ messageId: "bannedMapSetIter" }],
    },
    {
      code: `for (const v of new Set()) { /* ... */ }`,
      errors: [{ messageId: "bannedMapSetIter" }],
    },
    {
      code: `const m = new Map(); for (const v of m.values()) { /* ... */ }`,
      errors: [{ messageId: "bannedMapSetIter" }],
    },

    // ── Floating-point early warnings ─────────────────────────────
    { code: `const x = 2 ** 8;`, errors: [{ messageId: "warnPow" }] },
    { code: `const x = 5 / 2.5;`, errors: [{ messageId: "warnDiv" }] },
  ],
});
