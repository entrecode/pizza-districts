// PII / secret scrubbing for Sentry event payloads (PIZ-65).
//
// Sentry SDKs already strip request bodies with `sendDefaultPii=false`. This
// module is the second line: it walks the event tree and redacts values that
// are specific to Pizza Districts and that the SDK has no way to know about
// on its own.
//
// Scrub targets:
//   - Supabase user ids (UUID v4)
//   - Email addresses
//   - Google API keys (AIza...)
//   - brand_seed material (string field on simulation state)
//   - Authorization / cookie / set-cookie headers
//
// We mutate-in-place on a deep clone supplied by Sentry and return the same
// object. Returning `null` would drop the event entirely — we never do that;
// row 16 needs the trace to land, just with PII redacted.

const REDACTED = "[redacted]";

const PII_KEY_PATTERNS = [
  /^email$/i,
  /e-?mail/i,
  /^password$/i,
  /^passwd$/i,
  /^api[_-]?key$/i,
  /^auth(?:orization)?$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^session$/i,
  /^supabase[_-]?(?:user|auth)/i,
  /^brand[_-]?seed$/i,
  /^seed$/i,
];

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const GOOGLE_API_KEY_RE = /\bAIza[0-9A-Za-z_-]{35}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-+/=]+/g;

const redactString = (value: string): string =>
  value
    .replace(GOOGLE_API_KEY_RE, REDACTED)
    .replace(BEARER_RE, `Bearer ${REDACTED}`)
    .replace(EMAIL_RE, REDACTED)
    .replace(UUID_RE, REDACTED);

const isPiiKey = (key: string): boolean => PII_KEY_PATTERNS.some((re) => re.test(key));

const scrubValue = (value: unknown, key?: string): unknown => {
  if (value == null) return value;
  if (typeof value === "string") {
    if (key && isPiiKey(key)) return REDACTED;
    return redactString(value);
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isPiiKey(k) ? REDACTED : scrubValue(v, k);
  }
  return out;
};

// Sentry's Event types are structural; we walk the payload via unknown and
// hand the same-shaped object back to the SDK. Call sites cast through the
// SDK's own ErrorEvent / Event types — the scrubber preserves shape.
export const scrubEvent = <T>(event: T): T => {
  return scrubValue(event) as T;
};

export const __test__ = { redactString, isPiiKey, scrubValue };
