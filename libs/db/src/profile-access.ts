import { and, eq, isNull, or, sql, type AnyColumn } from 'drizzle-orm';

import { user } from './schema.js';

/** Restrict profile writes and reads to a live, unrestricted identity. */
export const activeProfileIdentity = (userId: string) =>
  and(
    eq(user.id, userId),
    eq(user.accountState, 'active'),
    or(eq(user.banned, false), isNull(user.banned)),
  );

/**
 * The same rule as {@link activeProfileIdentity}, correlated to a row that references an identity.
 *
 * A public read has two halves that have to agree: the member's profile and the rows attributed to
 * them. While only the profile consulted this rule, banning someone hid their profile and left
 * their gatherings on the discovery feed, each linking to a host page that answered 404 — the
 * suppression was visible to everyone except where it mattered. Both halves now ask the same
 * question of the same columns, so a moderation decision either applies everywhere or nowhere.
 *
 * This is the seam CO-09 replaces. When it lands, its visibility decision is read here and nowhere
 * else; a caller that writes its own `WHERE` around `account_state` silently opts out of whatever
 * CO-09 decides, which is the second moderation system this plan exists to avoid.
 */
export const visibleIdentity = (identityColumn: AnyColumn) =>
  sql`exists (select 1 from ${user}
    where ${user.id} = ${identityColumn}
      and ${user.accountState} = 'active'
      and (${user.banned} = 0 or ${user.banned} is null))`;
