import { and, eq, inArray, isNull, or, sql, type AnyColumn } from 'drizzle-orm';

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

/**
 * Whether a meetup that has already been published still stands, judged by its host.
 *
 * The rule of {@link visibleIdentity}, with one exception the privacy policy makes: a host whose
 * account was erased leaves their meetups in the city's record, with their name detached (#105).
 * The erased identity has no name or profile left to show, so keeping the meetup reveals nobody,
 * while an attendee keeps the meetup in their own list and its page stays where they saved it.
 * A banned host's meetups still go, erased or not, and so do those of an account still closing.
 *
 * It is for a meetup's own page, the lists attendees keep and the sitemap. Discovery, the host's
 * history and the counts keep {@link visibleIdentity}, since an erased host has no upcoming meetup
 * left to find and no history page left to list it on.
 */
export const visibleHost = (hostColumn: AnyColumn) =>
  sql`exists (select 1 from ${user}
    where ${user.id} = ${hostColumn}
      and ${user.accountState} in ('active', 'deleted')
      and (${user.banned} = 0 or ${user.banned} is null))`;

/** The rule of {@link visibleHost}, for one host read by id. */
export const visibleHostIdentity = (hostId: string) =>
  and(
    eq(user.id, hostId),
    inArray(user.accountState, ['active', 'deleted']),
    or(eq(user.banned, false), isNull(user.banned)),
  );
