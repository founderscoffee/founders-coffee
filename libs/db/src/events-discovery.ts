import { and, eq, gt, inArray, or } from 'drizzle-orm';

import type { Db } from './db.js';
import { upcomingScope } from './events.js';
import { events, markets, user, type Event } from './schema.js';

export type PublicEventDiscoveryRow = {
  readonly marketCode: string;
  readonly marketSlug: string;
  readonly timezone: string;
  readonly cityCode: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly venue: string;
  readonly venueAddress: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly language: Event['language'];
  readonly organizerName: string;
  readonly organizerEmail: string;
  readonly updatedAt: Date;
};

export const listPublicEventDiscoveryRows = async (
  db: Db,
  opts: {
    readonly marketCodes: readonly string[];
    readonly marketCode?: string;
    readonly afterStartsAt?: Date;
    readonly afterMarketSlug?: string;
    readonly afterSlug?: string;
    readonly limit?: number;
    readonly now?: Date;
  },
): Promise<PublicEventDiscoveryRow[]> => {
  if (opts.marketCodes.length === 0) return [];
  const cursor =
    opts.afterStartsAt && opts.afterMarketSlug && opts.afterSlug
      ? or(
          gt(events.startsAt, opts.afterStartsAt),
          and(
            eq(events.startsAt, opts.afterStartsAt),
            or(
              gt(markets.slug, opts.afterMarketSlug),
              and(
                eq(markets.slug, opts.afterMarketSlug),
                gt(events.slug, opts.afterSlug),
              ),
            ),
          ),
        )
      : undefined;
  return db
    .select({
      marketCode: events.marketCode,
      marketSlug: markets.slug,
      timezone: markets.timezone,
      cityCode: events.cityCode,
      slug: events.slug,
      title: events.title,
      description: events.description,
      venue: events.venue,
      venueAddress: events.venueAddress,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      language: events.language,
      organizerName: user.name,
      organizerEmail: user.email,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .innerJoin(markets, eq(markets.code, events.marketCode))
    .innerJoin(user, eq(user.id, events.hostId))
    .where(
      and(
        upcomingScope(opts.now ?? new Date()),
        eq(events.status, 'published'),
        inArray(markets.code, opts.marketCodes),
        opts.marketCode ? eq(markets.code, opts.marketCode) : undefined,
        cursor,
      ),
    )
    .orderBy(events.startsAt, markets.slug, events.slug)
    .limit(opts.limit ?? 20);
};
