import { env } from 'cloudflare:workers';

import { AppError, err, ok } from '@founders-coffee/core';
import {
  createDb,
  createEvent,
  enqueueNotification,
  eq,
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

export const HOST_ID = 'usr_sweephost';
export const MEMBER_ID = 'usr_sweepmember';
export const EVENT_ID = 'evt_sweep001';

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
    capacity: 50,
    language: 'ar_fr',
    category: 'coffee-meetup',
    status: 'published',
  }).catch(() => undefined);
  await db.delete(scheduledNotifications).run();
  await db.delete(pushSubscriptions).run();
  return db;
};

let counter = 0;

export const enqueue = async (
  db: Db,
  overrides: {
    channel?: 'sms' | 'email' | 'push';
    sendAt?: Date;
    fallbackChannel?: 'email';
    templateKey?: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h';
  } = {},
): Promise<string> => {
  const rowId = `ntf_sweep${String(++counter).padStart(3, '0')}`;
  await enqueueNotification(db, {
    id: rowId,
    eventId: EVENT_ID,
    userId: MEMBER_ID,
    channel: overrides.channel ?? 'sms',
    templateKey: overrides.templateKey ?? 'rsvp_confirmation',
    payload: {
      phoneNumber: '+213600000000',
      smsBody: 'body',
      email: 'member@sweep.test',
      subject: 'subject',
      html: '<p>hi</p>',
      pushTitle: 'title',
      pushBody: 'body',
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
