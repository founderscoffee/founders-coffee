import { z } from 'zod';

import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  listMarkets,
  listPublicEventDiscoveryRows,
  type Db,
} from '@founders-coffee/db';
import {
  events as eventDomain,
  geo,
  markets,
  profile,
} from '@founders-coffee/domain';
import { logger, reportError } from '@founders-coffee/observability';

import type { PublicEventFeedRequestInput } from './schemas.js';

type PublicEventDiscovery = eventDomain.PublicEventDiscovery;

const publicEventCursorSchema = z.strictObject({
  startsAt: z.number().int().positive().finite().max(Number.MAX_SAFE_INTEGER),
  market: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(80),
});

type PublicEventCursor = {
  readonly startsAt: number;
  readonly market: string;
  readonly slug: string;
};

const encodeCursor = (cursor: PublicEventCursor): string =>
  encodeURIComponent(JSON.stringify(cursor));

const decodeCursor = (value: string): PublicEventCursor | null => {
  try {
    const parsed = publicEventCursorSchema.safeParse(
      JSON.parse(decodeURIComponent(value)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const discoveryItem = (
  row: Awaited<ReturnType<typeof listPublicEventDiscoveryRows>>[number],
): PublicEventDiscovery | null => {
  const city = geo.findCity(row.marketCode, row.cityCode);
  if (!city) return null;
  const organizerName = profile.safeProfileDisplayName(
    row.organizerName,
    row.organizerEmail,
  );
  const result = eventDomain.publicEventDiscoverySchema.safeParse({
    market: row.marketSlug,
    city: city.slug,
    cityName: city.name,
    slug: row.slug,
    title: row.title,
    description: row.description,
    venue: row.venue,
    venueAddress: row.venueAddress,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    timezone: row.timezone,
    language: row.language,
    organizer: organizerName ? { name: organizerName } : null,
    status: 'published',
    updatedAt: row.updatedAt.toISOString(),
  });
  return result.success ? result.data : null;
};

export type PublicEventFeedPage = {
  readonly items: readonly PublicEventDiscovery[];
  readonly nextCursor: string | null;
};

export const readPublicEventFeed = async (
  db: Db,
  input: PublicEventFeedRequestInput,
): Promise<Result<PublicEventFeedPage>> => {
  logger.info('public_event_feed_requested', {
    market: input.market ?? 'all',
    limit: input.limit,
  });
  try {
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    if (input.cursor && !cursor) {
      return err(
        new AppError('validation_failed', 'Invalid event feed cursor'),
      );
    }
    const visibleMarkets = await listMarkets(db, {
      states: markets.VISIBLE_STATES,
    });
    const market = input.market
      ? visibleMarkets.find((entry) => entry.slug === input.market)
      : undefined;
    if (input.market && !market) return ok({ items: [], nextCursor: null });
    const rows = await listPublicEventDiscoveryRows(db, {
      marketCodes: visibleMarkets.map((entry) => entry.code),
      marketCode: market?.code,
      afterStartsAt: cursor ? new Date(cursor.startsAt) : undefined,
      afterMarketSlug: cursor?.market,
      afterSlug: cursor?.slug,
      limit: input.limit + 1,
    });
    const pageRows = rows.slice(0, input.limit);
    const items = pageRows.flatMap((row) => {
      const item = discoveryItem(row);
      return item ? [item] : [];
    });
    const last = pageRows[pageRows.length - 1];
    return ok({
      items,
      nextCursor:
        rows.length > input.limit && last
          ? encodeCursor({
              startsAt: last.startsAt.getTime(),
              market: last.marketSlug,
              slug: last.slug,
            })
          : null,
    });
  } catch (error) {
    reportError(error, {
      operation: 'read_public_event_feed',
      scope: 'global',
    });
    return err(
      new AppError(
        'event_feed_unavailable',
        'Public event discovery is temporarily unavailable',
      ),
    );
  }
};
