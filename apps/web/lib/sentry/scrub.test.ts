import { describe, expect, it } from "vitest";

import { __test__, scrubEvent } from "./scrub";

const { redactString, isPiiKey, scrubValue } = __test__;

describe("scrub.redactString", () => {
  it("redacts Google API keys", () => {
    const s = "url=https://maps.googleapis.com?key=AIza" + "A".repeat(35);
    expect(redactString(s)).toBe("url=https://maps.googleapis.com?key=[redacted]");
  });

  it("redacts UUIDs (Supabase user ids)", () => {
    expect(redactString("user 11111111-2222-3333-4444-555555555555 logged in")).toBe(
      "user [redacted] logged in",
    );
  });

  it("redacts email addresses", () => {
    expect(redactString("contact: alice@example.com or bob+spam@example.org")).toBe(
      "contact: [redacted] or [redacted]",
    );
  });

  it("redacts Bearer tokens but keeps the prefix", () => {
    expect(redactString("Authorization: Bearer abc.def-123/xyz=")).toBe(
      "Authorization: Bearer [redacted]",
    );
  });

  it("leaves benign strings alone", () => {
    expect(redactString("hello world")).toBe("hello world");
  });
});

describe("scrub.isPiiKey", () => {
  it.each([
    "email",
    "Email",
    "user_email",
    "password",
    "api_key",
    "API-KEY",
    "Authorization",
    "cookie",
    "set-cookie",
    "session",
    "supabase_user_id",
    "supabaseAuthToken",
    "brand_seed",
    "seed",
  ])("matches %s", (key) => {
    expect(isPiiKey(key)).toBe(true);
  });

  it.each(["name", "id", "tickNo", "release", "env"])("does not match %s", (key) => {
    expect(isPiiKey(key)).toBe(false);
  });
});

describe("scrub.scrubValue", () => {
  it("recursively redacts PII keys in nested objects", () => {
    const input = {
      message: "ok",
      ctx: {
        email: "alice@example.com",
        api_key: "secret",
        nested: { brand_seed: "xyz", note: "fine" },
      },
      tags: ["one", "two"],
    };
    const out = scrubValue(input);
    expect(out).toEqual({
      message: "ok",
      ctx: {
        email: "[redacted]",
        api_key: "[redacted]",
        nested: { brand_seed: "[redacted]", note: "fine" },
      },
      tags: ["one", "two"],
    });
  });

  it("redacts PII patterns inside string values", () => {
    const out = scrubValue({
      free_text: "ping bob@example.com from 11111111-2222-3333-4444-555555555555",
    }) as { free_text: string };
    expect(out.free_text).toBe("ping [redacted] from [redacted]");
  });
});

describe("scrubEvent", () => {
  it("preserves shape and redacts at every level", () => {
    type FakeEvent = {
      message: string;
      user?: { email?: string };
      extra?: Record<string, unknown>;
    };
    const event: FakeEvent = {
      message: "request failed for AIza" + "A".repeat(35),
      user: { email: "alice@example.com" },
      extra: { brand_seed: "abcdef", note: "fine" },
    };
    const out = scrubEvent(event);
    expect(out.message).toBe("request failed for [redacted]");
    expect(out.user?.email).toBe("[redacted]");
    expect(out.extra?.brand_seed).toBe("[redacted]");
    expect(out.extra?.note).toBe("fine");
  });
});
