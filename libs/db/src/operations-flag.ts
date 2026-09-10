import { eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { markets } from './schema.js';

/**
 * Whether community operations are switched on for this market.
 *
 * §5.26 requires the rollback to exist before the exposure does, so the flag defaults off and is
 * read here rather than in each surface. An absent key means off: a market row written before this
 * flag existed, or a JSON blob that lost it, resolves to disabled instead of to whatever
 * `undefined` happens to coerce to at the call site.
 *
 * A market that does not exist is also disabled. There is no configuration to consult and refusing
 * is the only answer that cannot expose an unfinished surface.
 *
 * The flag gates closeout, feedback, repeat-host, operations and metrics entry points. Moderation
 * and host trust are deliberately not gated — §5.26 keeps the safety controls available even when
 * the feature they oversee is switched off, because the reason to switch it off may be the reason
 * they are needed.
 */
export const communityOperationsEnabled = async (
  db: Db,
  marketCode: string,
): Promise<boolean> => {
  const rows = await db
    .select({ flags: markets.featureFlags })
    .from(markets)
    .where(eq(markets.code, marketCode))
    .limit(1);
  return rows[0]?.flags?.communityOperations === true;
};
