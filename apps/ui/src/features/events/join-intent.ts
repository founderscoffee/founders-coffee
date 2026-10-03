import { z } from 'zod';

const JOIN_INTENT_KEY = 'fc:join-intent';
const JOIN_INTENT_MAX_AGE_MS = 30 * 60_000;

const joinIntentSchema = z.object({
  eventId: z.string().min(1),
  savedAt: z.number().int().positive(),
});

/**
 * Remember, in this tab, that a signed-out reader pressed Join on `eventId`.
 *
 * Join cannot take a seat for someone the server does not know, so it sends them to sign in, and
 * sign-in ends with a fresh load of the meetup page, which forgot the press. On 2 October a reader
 * pressed Join, signed in, came back to the same Join button and left without pressing it again.
 * `takeJoinIntent` reads this back so the page can finish what they asked for.
 *
 * Session storage keeps it to the tab the reader pressed it in, and it survives the round trip
 * through Google or GitHub. Nothing outside this site can write it, which a flag in the address
 * could not promise: anyone could put one in a link and join whoever followed it. Storage that
 * throws leaves things as they were, with the reader returned to the button.
 */
export const rememberJoinIntent = (eventId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      JOIN_INTENT_KEY,
      JSON.stringify({ eventId, savedAt: Date.now() }),
    );
  } catch {
    return;
  }
};

/**
 * Whether this tab still owes `eventId` the Join its reader pressed before signing in.
 *
 * Reading spends the intent, whichever meetup asks, so one press joins at most one meetup, once.
 * It lasts thirty minutes, as long as the emailed sign-in code it may be waiting on.
 */
export const takeJoinIntent = (eventId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.sessionStorage.getItem(JOIN_INTENT_KEY);
    if (!stored) return false;
    window.sessionStorage.removeItem(JOIN_INTENT_KEY);
    const parsed = joinIntentSchema.safeParse(JSON.parse(stored));
    return (
      parsed.success &&
      parsed.data.eventId === eventId &&
      Date.now() - parsed.data.savedAt <= JOIN_INTENT_MAX_AGE_MS
    );
  } catch {
    return false;
  }
};
