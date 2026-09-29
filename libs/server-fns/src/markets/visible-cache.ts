import { marketFieldNames, type Db, type Market } from '@founders-coffee/db';
import { reportError } from '@founders-coffee/observability';

import { listVisibleMarkets } from './resolver.js';

const CACHE_NAME = 'visible-markets';
const MAX_AGE_SECONDS = 300;

/** The key the list is kept under: the site's own origin, and the fields a market row has. */
const listKey = (origin: string): Request =>
  new Request(
    new URL(`/visible-markets?fields=${marketFieldNames().join(',')}`, origin),
  );

/** This data centre's copy of the list, or `undefined` when it has none or cannot be read. */
const keptList = async (key: Request): Promise<Market[] | undefined> => {
  try {
    const copy = await (await caches.open(CACHE_NAME)).match(key);
    return copy ? ((await copy.json()) as Market[]) : undefined;
  } catch (error) {
    reportError(error, { operation: 'read_visible_markets_copy' });
    return undefined;
  }
};

/** Keep a copy of the list in this data centre, without failing the read if it cannot. */
const keepList = async (key: Request, list: readonly Market[]) => {
  try {
    await (
      await caches.open(CACHE_NAME)
    ).put(
      key,
      Response.json(list, {
        headers: { 'Cache-Control': `max-age=${MAX_AGE_SECONDS}` },
      }),
    );
  } catch (error) {
    reportError(error, { operation: 'keep_visible_markets_copy' });
  }
};

/**
 * The visible markets, from this data centre's copy while it is under five minutes old.
 *
 * The root route needs this list before any route below it may start reading, so reading it from
 * D1 put a whole round trip to the database's region in front of every page, Madrid to London for
 * a reader in Algeria (#114). The list changes only when a market opens or closes, so each data
 * centre keeps a copy for five minutes and a change reaches the lists within that time. Pages that
 * belong to a market still look their market up in D1, so a market that closes stops answering at
 * once and only its links linger.
 *
 * The copy is keyed by the request's origin, because staging and production share one zone and
 * with it one cache, and by the fields a market row has, so a deploy that changes the table never
 * reads rows of the old shape. On `workers.dev` the Cache API keeps nothing, and every call reads
 * D1 as before.
 */
export const cachedVisibleMarkets = async (
  db: Db,
  origin: string,
): Promise<Market[]> => {
  const key = listKey(origin);
  const kept = await keptList(key);
  if (kept) return kept;
  const list = await listVisibleMarkets(db);
  await keepList(key, list);
  return list;
};
