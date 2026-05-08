// Step 2 — AI competitor moves. ADR-0003 §6.2.
// Stream: `ai_moves`, seeded with `ai_seed_for(brand, day)` per formula sheet §3.

import { streamRng } from "../rng";
import type { AiCompetitor, TickEvent } from "../types";

export function step2_aiMoves(
  ai: AiCompetitor[],
  aiSeed: bigint,
  dayIndex: number,
): { events: TickEvent[] } {
  const events: TickEvent[] = [];
  // Sort by id for input-order independence (ADR §8 property).
  ai.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const competitor of ai) {
    const rng = streamRng("ai_moves", aiSeed, dayIndex, competitor.id);
    // Strength drift in [-5, +5], integer-scaled.
    const drift = rng.nextIntBelow(11) - 5;
    const next = Math.min(1000, Math.max(0, competitor.strength + drift));
    if (next !== competitor.strength) {
      events.push({
        kind: "ai_move",
        tickIndex: dayIndex,
        aiBrandId: competitor.id,
        payload: { from: competitor.strength, to: next, drift },
      });
      competitor.strength = next;
      competitor.lastMoveTick = dayIndex;
    }
  }
  return { events };
}
