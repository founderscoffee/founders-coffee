const SECRET_KEY =
  /(^|_)(secret|token|password|passwd|otp|authorization|cookie|apikey|api_key|privatekey|private_key|card|cvv|iban)(_|$)/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DEPTH = 8;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  value.constructor === Object;

const maskEmail = (value: string): string => {
  const at = value.indexOf('@');
  if (at <= 0) return value;
  const name = value.slice(0, at);
  const masked = name.length <= 1 ? '*' : name[0] + '*'.repeat(name.length - 1);
  return `${masked}@${value.slice(at + 1)}`;
};

/**
 * Deep-clone `value`, redacting secret/PII-bearing keys and masking emails, with
 * depth + circular guards. Runs on BOTH client (before forward) and server (on
 * ingest) so secrets never reach Workers Logs / Logpush (AGENTS.md §10, §13).
 */
export const sanitize = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown => {
  if (depth > MAX_DEPTH) return '[max-depth]';
  if (typeof value === 'string') return EMAIL.test(value) ? maskEmail(value) : value;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1, seen));
  }
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitize(raw, depth + 1, seen);
  }
  return out;
};
