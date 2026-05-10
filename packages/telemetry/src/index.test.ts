import { describe, expect, it, vi } from "vitest";
import {
  CANARY_FILTER_SQL_JSONB,
  CANARY_FILTER_SQL_TOPLEVEL,
  TelemetryEventSchema,
  consoleTransport,
  createTelemetry,
  httpTransport,
  noopTransport,
  type TelemetryEvent,
  type Transport,
} from "./index";

const fixedClock = () => new Date("2026-05-10T12:00:00.000Z");

const captureTransport = (): { events: TelemetryEvent[]; transport: Transport } => {
  const events: TelemetryEvent[] = [];
  return {
    events,
    transport: {
      send(event) {
        events.push(event);
      },
    },
  };
};

describe("@pd/telemetry — qa_canary contract", () => {
  it("defaults qa_canary to false on every event kind", () => {
    const { events, transport } = captureTransport();
    const t = createTelemetry({ transport, now: fixedClock });

    t.track({ name: "store.opened" });
    t.error({ name: "store.crashed", message: "boom" });
    t.pageView({ name: "page.view", path: "/dashboard" });
    t.custom({ name: "tick.applied" });

    expect(events.map((e) => [e.kind, e.name, e.qa_canary])).toEqual([
      ["track", "store.opened", false],
      ["error", "store.crashed", false],
      ["page_view", "page.view", false],
      ["custom", "tick.applied", false],
    ]);
  });

  it("propagates qa_canary=true through every event kind unmodified", () => {
    const { events, transport } = captureTransport();
    const t = createTelemetry({ transport, now: fixedClock });

    t.track({ name: "store.opened", qa_canary: true });
    t.error({ name: "store.crashed", qa_canary: true, message: "boom" });
    t.pageView({ name: "page.view", qa_canary: true, path: "/dashboard" });
    t.custom({ name: "tick.applied", qa_canary: true });

    expect(events.every((e) => e.qa_canary === true)).toBe(true);
    // Same prod sink — transport sees the same shape, only the flag differs.
    expect(events.map((e) => e.kind)).toEqual([
      "track",
      "error",
      "page_view",
      "custom",
    ]);
  });

  it("canaryPing fires a track event with qa_canary=true and stable name", () => {
    const { events, transport } = captureTransport();
    const t = createTelemetry({ transport, now: fixedClock });

    t.canaryPing("cycle-2026-W19");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "track",
      name: "qa.canary",
      qa_canary: true,
      properties: { label: "cycle-2026-W19" },
    });
  });

  it("canaryPing without a label still emits qa_canary=true", () => {
    const { events, transport } = captureTransport();
    const t = createTelemetry({ transport, now: fixedClock });

    t.canaryPing();

    expect(events[0]?.qa_canary).toBe(true);
    expect(events[0]?.name).toBe("qa.canary");
  });

  it("merges defaultContext into every event but lets per-event context override", () => {
    const { events, transport } = captureTransport();
    const t = createTelemetry({
      transport,
      now: fixedClock,
      defaultContext: { release: "v0.1.0", env: "prod" },
    });

    t.track({ name: "store.opened" });
    t.track({
      name: "store.opened",
      context: { env: "preview", session_id: "s1" },
    });

    expect(events[0]?.context).toEqual({ release: "v0.1.0", env: "prod" });
    expect(events[1]?.context).toEqual({
      release: "v0.1.0",
      env: "preview",
      session_id: "s1",
    });
  });

  it("validates the wire shape: TelemetryEventSchema accepts qa_canary boolean", () => {
    const ok = TelemetryEventSchema.safeParse({
      name: "qa.canary",
      kind: "track",
      qa_canary: true,
      ts: "2026-05-10T12:00:00.000Z",
      properties: {},
      context: {},
    });
    expect(ok.success).toBe(true);

    const bad = TelemetryEventSchema.safeParse({
      name: "x",
      kind: "track",
      qa_canary: "true",
      ts: "2026-05-10T12:00:00.000Z",
    });
    expect(bad.success).toBe(false);
  });

  it("error events forward message + stack into properties", () => {
    const { events, transport } = captureTransport();
    const t = createTelemetry({ transport, now: fixedClock });

    t.error({
      name: "places.proxy.failed",
      message: "upstream 502",
      stack: "Error: upstream 502\n  at fetcher",
      properties: { route: "/api/places" },
    });

    expect(events[0]?.properties).toMatchObject({
      message: "upstream 502",
      stack: "Error: upstream 502\n  at fetcher",
      route: "/api/places",
    });
  });

  it("swallowErrors=true (default) forwards transport failures to onError", async () => {
    const onError = vi.fn();
    const t = createTelemetry({
      transport: {
        send() {
          throw new Error("sink down");
        },
      },
      now: fixedClock,
      onError,
    });

    expect(() => t.track({ name: "x" })).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("swallowErrors=false rethrows synchronous transport failures", () => {
    const t = createTelemetry({
      transport: {
        send() {
          throw new Error("sink down");
        },
      },
      now: fixedClock,
      swallowErrors: false,
    });
    expect(() => t.track({ name: "x" })).toThrow("sink down");
  });
});

describe("@pd/telemetry — transports", () => {
  it("noopTransport is silent", () => {
    const t = createTelemetry({ transport: noopTransport(), now: fixedClock });
    expect(() => t.canaryPing()).not.toThrow();
  });

  it("consoleTransport surfaces canary tag for visibility in dev", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const t = createTelemetry({ transport: consoleTransport(), now: fixedClock });
    t.canaryPing("dev-smoke");
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0]?.[0])).toContain("·canary");
    spy.mockRestore();
  });

  it("httpTransport POSTs JSON with keepalive=true by default", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const t = createTelemetry({
      transport: httpTransport({ endpoint: "/api/telemetry", fetchImpl }),
      now: fixedClock,
    });
    t.canaryPing("cycle-2026-W19");
    // emit() is sync but transport.send is async — yield once.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);
    const body = JSON.parse(init?.body as string);
    expect(body.qa_canary).toBe(true);
    expect(body.name).toBe("qa.canary");
  });
});

describe("@pd/telemetry — dashboard filter convention", () => {
  it("exports the canonical filter predicates", () => {
    expect(CANARY_FILTER_SQL_TOPLEVEL).toBe("qa_canary IS NOT TRUE");
    expect(CANARY_FILTER_SQL_JSONB).toBe(
      "coalesce((properties ->> 'qa_canary')::boolean, false) = false",
    );
  });
});
