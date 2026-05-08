// Pure deterministic simulation engine. No I/O, no Date.now(), no Math.random().
// All randomness flows from a seeded PRNG; all time flows from explicit tick inputs.
// ADR-0003 will fix the engine surface; Phase 1 ships only the seeded PRNG primitives.

export { mulberry32, hashSeed, type Prng } from "./prng";
