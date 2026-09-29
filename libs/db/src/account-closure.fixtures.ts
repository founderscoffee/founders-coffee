import { env } from 'cloudflare:workers';

import { id } from '@founders-coffee/core';

import {
  account,
  cityWaitlist,
  createDb,
  createEvent,
  eq,
  eventAttendance,
  eventFeedback,
  eventRsvps,
  eventTelegramInvites,
  initializeMemberProfile,
  pushSessionLinks,
  pushSubscriptions,
  reserveProfileAsset,
  scheduledNotifications,
  seed,
  session,
  user,
  verification,
  type Db,
} from './index.js';

export const PAST = new Date('2026-01-10T18:00:00Z');
export const NOW = new Date('2026-06-15T12:00:00Z');
export const SOON = new Date('2026-06-20T18:00:00Z');

let counter = 0;

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  return db;
};

export const person = async (
  db: Db,
  name: string,
): Promise<{ id: string; email: string }> => {
  const userId = id('usr');
  const email = `${name.toLowerCase()}_${userId}@closing.test`;
  await db.insert(user).values({ id: userId, name, email });
  await initializeMemberProfile(db, userId);
  return { id: userId, email };
};

export const meetup = async (
  db: Db,
  hostId: string,
  startsAt: Date,
  endsAt: Date | null = new Date(startsAt.getTime() + 2 * 3_600_000),
): Promise<string> => {
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `closing-${++counter}`,
    hostId,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Closing fixture ${counter}`,
    description: 'Account closure fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt,
    endsAt,
    language: 'fr',
  });
  return eventId;
};

export const rsvp = (db: Db, eventId: string, userId: string) =>
  db.insert(eventRsvps).values({ id: id('rsv'), eventId, userId });

export const attended = (
  db: Db,
  eventId: string,
  opts: { userId: string; recordedBy: string },
) =>
  db.insert(eventAttendance).values({
    id: id('att'),
    eventId,
    userId: opts.userId,
    recordedByUserId: opts.recordedBy,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    outcome: 'attended',
  });

export const feedback = (db: Db, eventId: string, userId: string) =>
  db.insert(eventFeedback).values({
    id: id('fbk'),
    eventId,
    userId,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    valueRating: 'valuable',
    wouldReturn: true,
    comment: 'I am the one who brought the croissants',
    commentLanguage: 'en',
  });

/** Give a member one of everything the erasure has to remove, and close their account. */
export const closeWithEverything = async (
  db: Db,
  member: { id: string; email: string },
  eventId: string,
) => {
  const sessionId = id('ses');
  const subscriptionId = id('psh');
  await db.insert(session).values({
    id: sessionId,
    userId: member.id,
    token: id('tok'),
    expiresAt: SOON,
  });
  await db.insert(account).values({
    id: id('acc'),
    userId: member.id,
    providerId: 'google',
    accountId: `google-${member.id}`,
  });
  await db.insert(pushSubscriptions).values({
    id: subscriptionId,
    userId: member.id,
    token: id('fcm'),
    platform: 'web',
    surface: 'pwa',
    marketCode: 'DZ',
  });
  await db
    .insert(pushSessionLinks)
    .values({ subscriptionId, sessionId, userId: member.id });
  const photo = await reserveProfileAsset(db, member.id, SOON);
  await db.insert(verification).values([
    {
      id: id('ver'),
      identifier: `sign-in-otp-${member.email}`,
      value: 'hashed:0',
      expiresAt: SOON,
    },
    {
      id: id('ver'),
      identifier: `change-email-otp-${member.email}-next@closing.test`,
      value: 'hashed:0',
      expiresAt: SOON,
    },
  ]);
  await db.insert(cityWaitlist).values({
    id: id('wtl'),
    email: member.email,
    marketCode: 'DZ',
    cityCode: '1',
    locale: 'ar',
  });
  await db.insert(scheduledNotifications).values({
    id: id('ntf'),
    eventId,
    userId: member.id,
    channel: 'email',
    status: 'sent',
    templateKey: 'rsvp_confirmation',
    payload: { email: member.email },
    sendAt: PAST,
  });
  await db.insert(eventTelegramInvites).values({
    id: id('tgi'),
    eventId,
    userId: member.id,
    inviteLink: `https://t.me/+closing${++counter}`,
  });
  await db
    .update(user)
    .set({
      accountState: 'closing',
      closedAt: NOW,
      phoneNumber: '+213555010203',
    })
    .where(eq(user.id, member.id));
  return { sessionId, subscriptionId, photo };
};
