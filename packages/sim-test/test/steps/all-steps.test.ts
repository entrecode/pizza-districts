// §6.4 per-step unit tests — one assertion per canonical 11-step order
// (per [ADR-0003 §6.2](/PIZ/issues/PIZ-6#document-adr) and the
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §6.4
// matrix).
//
// Engine-blocked: depends on `@pd/sim` exporting per-step functions
// (PIZ-31 dependency §2). Until then, this file holds one placeholder
// per step so the matrix is visible in the test output and so the engine
// PR only has to drop in the per-step imports.
//
// When the engine lands, split this into one file per step under
// `test/steps/step-<name>.test.ts` per spec §8.

import { describe, it } from "vitest";

const ENGINE_READY = process.env.ENGINE_READY === "1";

const STEPS = [
  {
    idx: 1,
    name: "weather",
    note: "Reserved no-op in v0.5/v0.5.1/v0.6 — asserts state byte-equal pre/post.",
  },
  {
    idx: 2,
    name: "ai-moves",
    note: "AI moves stable given ai_seed = hash(world_seed, ai_brand_id, day_index).",
  },
  {
    idx: 3,
    name: "marketing",
    note: "Budget debit + decay applied before demand sees marketing_reach.",
  },
  {
    idx: 4,
    name: "demand",
    note: "customer_arrival.formula matches LUT outputs across price_pull × awareness × rating_pull × dow × noise.",
  },
  {
    idx: 5,
    name: "finance",
    note: "Sales/COGS/rent/payroll deterministic; weekly rent fires at day_index % 7 == 0.",
  },
  { idx: 6, name: "reviews", note: "r_d = round(1 + 4 × satisfaction); seed = review_seed." },
  {
    idx: 7,
    name: "rating30",
    note: "rating_30_scaled = ((29 × prev + r_d_scaled) / 30), integer-scaled, no FP drift.",
  },
  {
    idx: 8,
    name: "staff",
    note: "Reserved no-op in v0.5/v0.5.1/v0.6 — asserts state byte-equal pre/post.",
  },
  {
    idx: 9,
    name: "bankruptcy",
    note: "consecutive_negative_cash_days increments only on negative end-of-finance cash; settlement at counter = 14.",
  },
  {
    idx: 10,
    name: "events",
    note: "Narrative events stable; pause-on-event triggers fire deterministically.",
  },
  {
    idx: 11,
    name: "hash",
    note: "tick_hash = blake3(prevHash || canonicalJson(events) || canonicalJson(stateDelta)).",
  },
];

describe("§6.4 per-step unit tests", () => {
  for (const s of STEPS) {
    if (ENGINE_READY) {
      it(`step ${s.idx} (${s.name}) — ${s.note}`, () => {
        throw new Error(
          `ENGINE_READY=1 reached but per-step export for step ${s.idx} (${s.name}) is not yet wired`,
        );
      });
    } else {
      it.skip(`step ${s.idx} (${s.name}) — blocked on @pd/sim per-step exports (PIZ-31 dep §2)`, () => {});
    }
  }
});
