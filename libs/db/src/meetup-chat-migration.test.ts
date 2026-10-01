import { env } from 'cloudflare:workers';
import { inArray, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { idSchema } from '@founders-coffee/core';

import {
  CHAT_KEPT_AFTER_MEETUP_SECONDS,
  CHAT_OPEN_AFTER_MEETUP_SECONDS,
  chatExpiresAt,
  chatReadOnlyAt,
} from './chat-channels.js';
import { createDb } from './db.js';
import { atMigration, priorHost } from './migrations.fixtures.js';
import { events } from './schema.js';

const DAY = 24 * 60 * 60;

type PriorMeetup = {
  readonly id: string;
  readonly endsAt: number;
  readonly status?: 'published' | 'cancelled';
  readonly cancelledAt?: number | null;
  readonly updatedAt?: number;
};

/** A meetup as the schema before 0041 holds it, ending at `endsAt` after a two-hour start. */
const insertPriorMeetup = (meetup: PriorMeetup) =>
  env.PRIOR_DB.prepare(
    `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description,
       venue, starts_at, ends_at, language, slug, status, cancelled_at, updated_at)
     VALUES (?, ?, 'DZ', '16', '1', 'Prior chat meetup', 'Before the chat.', 'Migration Café',
       ?, ?, 'fr', ?, ?, ?, ?)`,
  )
    .bind(
      meetup.id,
      priorHost.id,
      meetup.endsAt - 2 * 60 * 60,
      meetup.endsAt,
      `prior-chat-${meetup.id}`,
      meetup.status ?? 'published',
      meetup.cancelledAt ?? null,
      meetup.updatedAt ?? meetup.endsAt,
    )
    .run();

type ChannelRow = {
  id: string;
  kind: string;
  event_id: string;
  market_code: string;
  read_only_at: number;
  expires_at: number;
};

describe('0041 — meetup chat (real D1)', () => {
  it('gives every meetup still inside its 90 days one chat, with the lifetime publishing gives', async () => {
    const { event, suffix, apply } = await atMigration('0041_meetup_chat.sql');
    const now = Math.floor(Date.now() / 1000);
    const meetups = {
      recent: `evt_chat_recent_${suffix}`,
      old: `evt_chat_old_${suffix}`,
      cancelled: `evt_chat_cancelled_${suffix}`,
      cancelledBefore: `evt_chat_cancelled_before_${suffix}`,
      cancelledLongAgo: `evt_chat_cancelled_long_ago_${suffix}`,
    };
    await insertPriorMeetup({ id: meetups.recent, endsAt: now - 30 * DAY });
    await insertPriorMeetup({ id: meetups.old, endsAt: now - 100 * DAY });
    await insertPriorMeetup({
      id: meetups.cancelled,
      endsAt: now + 10 * DAY,
      status: 'cancelled',
      cancelledAt: now - 10 * DAY,
    });
    await insertPriorMeetup({
      id: meetups.cancelledBefore,
      endsAt: now + 10 * DAY,
      status: 'cancelled',
      updatedAt: now - 20 * DAY,
    });
    await insertPriorMeetup({
      id: meetups.cancelledLongAgo,
      endsAt: now + 10 * DAY,
      status: 'cancelled',
      cancelledAt: now - 100 * DAY,
    });
    const ids = [event.id, ...Object.values(meetups)];

    await apply();

    const channels = (
      await env.PRIOR_DB.prepare(
        `SELECT * FROM chat_channels WHERE event_id IN (${ids.map(() => '?').join(', ')})`,
      )
        .bind(...ids)
        .all<ChannelRow>()
    ).results;
    const byMeetup = new Map(channels.map((row) => [row.event_id, row]));
    expect([...byMeetup.keys()].sort()).toEqual(
      [
        event.id,
        meetups.recent,
        meetups.cancelled,
        meetups.cancelledBefore,
      ].sort(),
    );
    expect(channels).toHaveLength(4);
    for (const channel of channels) {
      expect(channel).toMatchObject({ kind: 'meetup', market_code: 'DZ' });
      expect(idSchema.safeParse(channel.id).success).toBe(true);
    }

    const upcomingEnd = event.startsAt.getTime() / 1000 + 2 * 60 * 60;
    expect(byMeetup.get(event.id)).toMatchObject({
      read_only_at: upcomingEnd + CHAT_OPEN_AFTER_MEETUP_SECONDS,
      expires_at: upcomingEnd + CHAT_KEPT_AFTER_MEETUP_SECONDS,
    });
    expect(byMeetup.get(meetups.cancelled)).toMatchObject({
      read_only_at: now - 10 * DAY,
      expires_at: now - 10 * DAY + CHAT_KEPT_AFTER_MEETUP_SECONDS,
    });
    expect(byMeetup.get(meetups.cancelledBefore)?.read_only_at).toBe(
      now - 20 * DAY,
    );

    const derived = await createDb(env.PRIOR_DB)
      .select({
        eventId: events.id,
        readOnlyAt: sql<number>`${chatReadOnlyAt()}`,
        expiresAt: sql<number>`${chatExpiresAt()}`,
      })
      .from(events)
      .where(inArray(events.id, ids));
    for (const meetup of derived) {
      const channel = byMeetup.get(meetup.eventId);
      if (meetup.expiresAt > now) {
        expect(
          channel,
          `the backfill and the repository agree on the chat of ${meetup.eventId}`,
        ).toMatchObject({
          read_only_at: meetup.readOnlyAt,
          expires_at: meetup.expiresAt,
        });
      } else {
        expect(channel).toBeUndefined();
      }
    }
  });
});
