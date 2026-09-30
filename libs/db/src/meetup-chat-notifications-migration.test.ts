import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { atMigration, priorHost } from './migrations.fixtures.js';

describe('0042 — the meetup chat’s notification category (real D1)', () => {
  it('turns the chat’s push on for every member, as a new member gets it, and leaves their other choices alone', async () => {
    const { apply } = await atMigration('0042_meetup_chat_notifications.sql');
    await env.PRIOR_DB.prepare(
      `INSERT INTO account_preferences
         (user_id, event_updates, event_updates_channels, event_reminders, event_reminders_channels,
          follow_up_prompts, follow_up_prompts_channels, revision)
       VALUES (?, 0, 0, 1, 4, 0, 0, 3)`,
    )
      .bind(priorHost.id)
      .run();

    await apply();

    expect(
      await env.PRIOR_DB.prepare(
        `SELECT event_updates, event_updates_channels, event_reminders, event_reminders_channels,
                follow_up_prompts, follow_up_prompts_channels, meetup_chat, meetup_chat_channels,
                revision
           FROM account_preferences WHERE user_id = ?`,
      )
        .bind(priorHost.id)
        .first(),
    ).toEqual({
      event_updates: 0,
      event_updates_channels: 0,
      event_reminders: 1,
      event_reminders_channels: 4,
      follow_up_prompts: 0,
      follow_up_prompts_channels: 0,
      meetup_chat: 1,
      meetup_chat_channels: 1,
      revision: 3,
    });
  });
});
