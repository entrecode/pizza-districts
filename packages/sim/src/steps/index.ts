// Canonical 11-step exports — required by determinism-harness §6.4.
// The order in this barrel is the canonical execution order; the harness
// asserts that runTick composes them in this sequence.

export { step1_weather } from "./step1_weather";
export { step2_aiMoves } from "./step2_aiMoves";
export { step3_marketing } from "./step3_marketing";
export { step4_demand } from "./step4_demand";
export { step5_finance } from "./step5_finance";
export { step6_reviews } from "./step6_reviews";
export { step7_rating30 } from "./step7_rating30";
export { step8_staff } from "./step8_staff";
export { step9_bankruptcy } from "./step9_bankruptcy";
export { step10_events } from "./step10_events";
export { step11_emit } from "./step11_emit";

export const CANONICAL_STEP_ORDER = [
  "step1_weather",
  "step2_aiMoves",
  "step3_marketing",
  "step4_demand",
  "step5_finance",
  "step6_reviews",
  "step7_rating30",
  "step8_staff",
  "step9_bankruptcy",
  "step10_events",
  "step11_emit",
] as const;

export type CanonicalStepName = (typeof CANONICAL_STEP_ORDER)[number];
