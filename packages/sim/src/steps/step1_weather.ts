// Step 1 — Weather + macro modifiers. ADR-0003 §6.2.
// Stream: `weather`, seeded from (world_seed, day_index).

import { streamRng } from "../rng";
import type { TickEvent, WeatherCode, WorldState } from "../types";

export function step1_weather(
  world: WorldState,
  daySeed: bigint,
  worldSeed: bigint,
  dayIndex: number,
): { events: TickEvent[] } {
  const rng = streamRng("weather", worldSeed ^ daySeed, dayIndex);
  const draw = rng.nextIntBelow(100);
  const weather: WeatherCode = draw < 60 ? 0 : draw < 85 ? 1 : draw < 97 ? 2 : 3;
  const events: TickEvent[] = [];
  if (weather !== world.weather || world.weatherDay !== dayIndex) {
    events.push({
      kind: "weather_changed",
      tickIndex: dayIndex,
      payload: { weather, prev: world.weather },
    });
  }
  world.weather = weather;
  world.weatherDay = dayIndex;
  return { events };
}
