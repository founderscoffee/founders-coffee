import { beforeEach, describe, expect, it } from 'vitest';

import { type Db } from '@founders-coffee/db';

import { resolveDestination } from './notification-destination.js';
import { sweepNotifications } from './notification-sweep.js';
import {
  MEMBER_ID,
  addPushToken,
  allRows,
  enqueue,
  fakePush,
  providers,
  rowById,
  setPreferences,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

describe('category channel matrix', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it.each(['reminder_24h', 'event_cancelled', 'rsvp_received'] as const)(
    'allows email and refuses push for email-only %s',
    async (template) => {
      await setPreferences(db, {
        eventUpdatesChannels: 4,
        eventRemindersChannels: 4,
        hostUpdatesChannels: 4,
        followUpPromptsChannels: 4,
      });
      await addPushToken(db, 'device-email-only');

      const email = await resolveDestination(db, 'email', MEMBER_ID, template);
      const push = await resolveDestination(db, 'push', MEMBER_ID, template);

      expect(email.ok).toBe(true);
      expect(push.ok).toBe(false);
      if (!push.ok) expect(push.reason).toBe('push_disabled');
    },
  );

  it.each([
    'reminder_24h',
    'event_cancelled',
    'rsvp_received',
    'feedback_invitation',
  ] as const)(
    'does not create a fallback when %s has no channels',
    async (template) => {
      const rowId = await enqueue(db, {
        channel: 'push',
        templateKey: template,
        fallbackChannel: 'email',
      });
      await addPushToken(db, `device-off-${template}`);
      await setPreferences(db, {
        eventUpdatesChannels: 0,
        eventRemindersChannels: 0,
        hostUpdatesChannels: 0,
        followUpPromptsChannels: 0,
      });

      await sweepNotifications(db, providers({ push: fakePush('ok') }), NOW);

      expect(
        (await allRows(db)).filter((row) => row.fallbackOf !== null),
      ).toEqual([]);
      expect((await rowById(db, rowId))?.status).toBe('failed');
    },
  );
});
