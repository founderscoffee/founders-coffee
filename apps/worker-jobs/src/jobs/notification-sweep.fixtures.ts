import { env } from 'cloudflare:workers';

import { AppError, err, ok } from '@founders-coffee/core';
import {
  createDb,
  createEvent,
  enqueueNotification,
  eq,
  pushSessionLinks,
  pushSubscriptions,
  scheduledNotifications,
  seed,
  user,
  type Db,
  type ScheduledNotification,
} from '@founders-coffee/db';
import type { EmailProvider } from '@founders-coffee/email';
import type {
  NotificationSmsProvider,
  PushProvider,
} from '@founders-coffee/notifications';

import type { DispatchProviders } from './notification-dispatch.js';
import {
  MEMBER_ID,
  setPreferences,
} from './notification-preferences.fixtures.js';

export {
  MEMBER_ID,
  setPreferences,
} from './notification-preferences.fixtures.js';

export const HOST_ID = 'usr_sweephost';
export const EVENT_ID = 'evt_sweep001';
export const OTHER_EVENT_ID = 'evt_sweep002';
export const MEMBER_PHONE = '+213600000000';

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'Sweep Host',
        email: 'host@sweep.test',
        emailVerified: false,
        role: 'host',
      },
      {
        id: MEMBER_ID,
        name: 'Sweep Member',
        email: 'member@sweep.test',
        emailVerified: false,
        phoneNumber: MEMBER_PHONE,
        phoneNumberVerified: true,
        role: 'member',
      },
    ])
    .onConflictDoNothing()
    .run();
  await createEvent(db, {
    id: EVENT_ID,
    slug: 'sweep-fixture-event',
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: 'Sweep fixture',
    description: 'Notification sweep fixture event.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    language: 'fr',
    status: 'published',
  }).catch(() => undefined);
  await createEvent(db, {
    id: OTHER_EVENT_ID,
    slug: 'sweep-fixture-other',
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: 'Sweep fixture (other)',
    description: 'A second event, so scoping can be told from luck.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-16T18:00:00Z'),
    language: 'fr',
    status: 'published',
  }).catch(() => undefined);
  await db
    .update(user)
    .set({
      accountState: 'active',
      phoneNumber: MEMBER_PHONE,
      phoneNumberVerified: true,
      email: 'member@sweep.test',
    })
    .where(eq(user.id, MEMBER_ID))
    .run();
  await db.delete(pushSessionLinks).run();
  await db.delete(scheduledNotifications).run();
  await db.delete(pushSubscriptions).run();
  await setPreferences(db, {
    eventUpdates: true,
    eventReminders: true,
    hostRsvpReceived: true,
    hostRsvpCancelled: true,
    followUpPromptsChannels: 4,
    pushEnabled: true,
    smsFallbackEnabled: true,
  });
  return db;
};

let counter = 0;

export const enqueue = async (
  db: Db,
  overrides: {
    channel?: 'sms' | 'email' | 'push';
    eventId?: string;
    sendAt?: Date;
    fallbackChannel?: 'email' | 'sms';
    templateKey?:
      | 'rsvp_confirmation'
      | 'reminder_72h'
      | 'reminder_24h'
      | 'event_cancelled'
      | 'rsvp_received'
      | 'rsvp_cancelled'
      | 'feedback_invitation';
    payload?: Record<string, unknown>;
  } = {},
): Promise<string> => {
  const rowId = `ntf_sweep${String(++counter).padStart(3, '0')}`;
  await enqueueNotification(db, {
    id: rowId,
    eventId: overrides.eventId ?? EVENT_ID,
    userId: MEMBER_ID,
    channel: overrides.channel ?? 'sms',
    templateKey: overrides.templateKey ?? 'rsvp_confirmation',
    payload: {
      eventTitle: 'Sweep fixture',
      eventSlug: 'sweep-fixture-event',
      marketCode: 'DZ',
      startsAt: '2099-01-15T18:00:00.000Z',
      venue: 'Café des Délices, Hydra',
      locale: 'en',
      phoneNumber: MEMBER_PHONE,
      smsBody: 'body',
      email: 'member@sweep.test',
      subject: 'subject',
      html: '<p>hi</p>',
      pushTitle: 'title',
      pushBody: 'body',
      ...overrides.payload,
    },
    sendAt: overrides.sendAt ?? new Date('2020-01-01T00:00:00Z'),
    fallbackChannel: overrides.fallbackChannel,
  });
  return rowId;
};

export const rowById = async (
  db: Db,
  rowId: string,
): Promise<ScheduledNotification | undefined> => {
  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.id, rowId))
    .limit(1);
  return rows[0];
};

export const allRows = async (db: Db): Promise<ScheduledNotification[]> =>
  db.select().from(scheduledNotifications);

export const addPushToken = async (db: Db, token: string): Promise<void> => {
  await db
    .insert(pushSubscriptions)
    .values({
      id: `push_${token}`,
      userId: MEMBER_ID,
      token,
      platform: 'web',
      surface: 'pwa',
      marketCode: 'DZ',
    })
    .onConflictDoNothing()
    .run();
};

export const fakeSms = (
  outcome: 'ok' | 'transient' | 'permanent',
): NotificationSmsProvider => ({
  name: 'fake-sms',
  send: async () =>
    outcome === 'ok'
      ? ok({ sid: 'sm1', segments: 1 })
      : err(
          new AppError(
            outcome === 'permanent'
              ? 'sms_permanent_failure'
              : 'sms_transient_failure',
            `sms ${outcome}`,
          ),
        ),
});

export const fakeEmail = (outcome: 'ok' | 'err'): EmailProvider => ({
  name: 'fake-email',
  send: async () =>
    outcome === 'ok'
      ? ok({ messageId: 'mid' })
      : err(new AppError('email_send_failed', 'email boom')),
});

export const fakePush = (outcome: 'ok' | 'err'): PushProvider => ({
  name: 'fake-push',
  send: async () =>
    outcome === 'ok'
      ? ok({ messageId: 'pid' })
      : err(new AppError('push_transient_failure', 'push boom')),
});

/** An SMS provider that records every send, so a test can count dispatches rather than row states. */
export const countingSms = (): {
  provider: NotificationSmsProvider;
  sends: string[];
} => {
  const sends: string[] = [];
  return {
    sends,
    provider: {
      name: 'counting-sms',
      send: async (input) => {
        sends.push(input.to);
        return ok({ sid: `sm${sends.length}`, segments: 1 });
      },
    },
  };
};

/** A push provider that records every send, including the dedupe key it was handed. */
export const countingPush = (): {
  provider: PushProvider;
  sends: { token: string; dedupeKey?: string }[];
} => {
  const sends: { token: string; dedupeKey?: string }[] = [];
  return {
    sends,
    provider: {
      name: 'counting-push',
      send: async (input) => {
        sends.push({ token: input.token, dedupeKey: input.dedupeKey });
        return ok({ messageId: `p${sends.length}` });
      },
    },
  };
};

export const throwingSms = (): NotificationSmsProvider => ({
  name: 'throwing-sms',
  send: async () => {
    throw new Error('provider exploded');
  },
});

export const providers = (
  overrides: Partial<DispatchProviders> = {},
): DispatchProviders => ({
  sms: fakeSms('ok'),
  email: fakeEmail('ok'),
  push: null,
  ...overrides,
});
