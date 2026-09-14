export interface PushPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly icon: string;
  readonly dedupeKey: string | null;
}

const DEFAULT_TITLE = 'founders.coffee';

const DEFAULT_ICON = '/android-chrome-192x192.png';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Read a push message whatever envelope it arrives in.
 *
 * FCM does not deliver what the sender wrote. A `webpush.data` message reaches the browser wrapped
 * as `{ data: { … } }` alongside FCM's own fields, a `webpush.notification` message as
 * `{ notification: { … } }`, and a message sent straight through the Web Push protocol arrives flat.
 * This worker has to display all three, and the exact envelope cannot be confirmed from here — no
 * push has ever been delivered to this app, because no provider has ever been configured. Being
 * liberal about the shape is therefore not defensiveness for its own sake: it is the difference
 * between the first real push rendering and the first real push rendering as `undefined`.
 *
 * A same-origin path is enforced on `url` because the click handler navigates to it. The value
 * comes from our own producer today, but a notification is attacker-reachable in the shape of
 * whatever the push service delivers, and a worker that will navigate anywhere it is told is a
 * redirect waiting to be used.
 */
export const readPushPayload = (raw: unknown): PushPayload => {
  const envelope = asRecord(raw);
  const notification = asRecord(envelope?.notification);
  const sources = [
    asRecord(envelope?.data),
    notification,
    asRecord(notification?.data),
    envelope,
  ];

  const read = (key: string): string | null =>
    sources.map((source) => text(source?.[key])).find(Boolean) ?? null;

  return {
    title: read('title') ?? DEFAULT_TITLE,
    body: read('body') ?? '',
    url: samePathOr(read('url'), '/'),
    icon: read('icon') ?? DEFAULT_ICON,
    dedupeKey: read('dedupeKey'),
  };
};

/**
 * Keep a click on this origin, as a path.
 *
 * An absolute URL for our own site is what the producer sends, and it is reduced to its path so the
 * worker's `client.navigate` stays within the page it already controls. Anything else — another
 * origin, a `javascript:` scheme, an unparseable string — falls back rather than being followed.
 */
export const samePathOr = (value: string | null, fallback: string): string => {
  if (!value) return fallback;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};
