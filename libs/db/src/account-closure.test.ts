import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import { eraseClosedAccount, erasedEmail } from './account-closure.js';
import {
  NOW,
  PAST,
  attended,
  closeWithEverything,
  feedback,
  meetup,
  person,
  rsvp,
  setupDb,
} from './account-closure.fixtures.js';
import {
  account,
  accountPreferences,
  cityWaitlist,
  eq,
  eventAttendance,
  eventFeedback,
  eventRsvps,
  events,
  eventTelegramInvites,
  memberProfiles,
  profileAssets,
  pushSessionLinks,
  pushSubscriptions,
  scheduledNotifications,
  session,
  user,
  verification,
  type Db,
} from './index.js';

const rowsFor = async (db: Db, userId: string) => ({
  profiles: await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, userId)),
  preferences: await db
    .select()
    .from(accountPreferences)
    .where(eq(accountPreferences.userId, userId)),
  photos: await db
    .select()
    .from(profileAssets)
    .where(eq(profileAssets.userId, userId)),
  sessions: await db.select().from(session).where(eq(session.userId, userId)),
  providers: await db.select().from(account).where(eq(account.userId, userId)),
  devices: await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId)),
  deviceLinks: await db
    .select()
    .from(pushSessionLinks)
    .where(eq(pushSessionLinks.userId, userId)),
  notices: await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.userId, userId)),
  invites: await db
    .select()
    .from(eventTelegramInvites)
    .where(eq(eventTelegramInvites.userId, userId)),
});

const closedHostWithHistory = async () => {
  const db = await setupDb();
  const host = await person(db, 'Nadia');
  const guest = await person(db, 'Karim');
  const otherHost = await person(db, 'Lina');
  const hosted = await meetup(db, host.id, PAST);
  const joined = await meetup(db, otherHost.id, PAST);
  await rsvp(db, hosted, guest.id);
  await attended(db, hosted, { userId: guest.id, recordedBy: host.id });
  await feedback(db, hosted, guest.id);
  await rsvp(db, joined, host.id);
  await attended(db, joined, { userId: host.id, recordedBy: otherHost.id });
  await feedback(db, joined, host.id);
  await closeWithEverything(db, host, joined);
  return { db, host, guest, hosted, joined };
};

describe('erasing a closed account (#105, real D1)', () => {
  it("removes everything that was the member's own", async () => {
    const { db, host } = await closedHostWithHistory();

    expect(
      await eraseClosedAccount(db, {
        id: host.id,
        email: host.email,
        phoneNumber: '+213555010203',
      }),
    ).toBe(true);

    expect(await rowsFor(db, host.id)).toEqual({
      profiles: [],
      preferences: [],
      photos: [],
      sessions: [],
      providers: [],
      devices: [],
      deviceLinks: [],
      notices: [],
      invites: [],
    });
    expect(
      await db
        .select()
        .from(cityWaitlist)
        .where(eq(cityWaitlist.email, host.email)),
    ).toEqual([]);
    const codes = await db.select().from(verification);
    expect(codes.filter((row) => row.identifier.includes(host.email))).toEqual(
      [],
    );
  });

  it('leaves a tombstone with nothing personal on it', async () => {
    const { db, host } = await closedHostWithHistory();

    await eraseClosedAccount(db, {
      id: host.id,
      email: host.email,
      phoneNumber: '+213555010203',
    });

    const [tombstone] = await db
      .select()
      .from(user)
      .where(eq(user.id, host.id));
    expect(tombstone).toMatchObject({
      name: '',
      email: erasedEmail(host.id),
      emailVerified: false,
      image: null,
      phoneNumber: null,
      localePref: null,
      role: 'member',
      accountState: 'deleted',
      closedAt: NOW,
    });
  });

  it("keeps the host's meetup and every other member's record of it", async () => {
    const { db, host, guest, hosted } = await closedHostWithHistory();

    await eraseClosedAccount(db, {
      id: host.id,
      email: host.email,
      phoneNumber: null,
    });

    const [event] = await db.select().from(events).where(eq(events.id, hosted));
    expect(event).toMatchObject({ hostId: host.id, status: 'published' });
    expect(
      await db
        .select({ userId: eventRsvps.userId })
        .from(eventRsvps)
        .where(eq(eventRsvps.eventId, hosted)),
    ).toEqual([{ userId: guest.id }]);
    expect(
      await db
        .select({ recordedBy: eventAttendance.recordedByUserId })
        .from(eventAttendance)
        .where(eq(eventAttendance.userId, guest.id)),
    ).toEqual([{ recordedBy: host.id }]);
    expect(
      await db
        .select({ comment: eventFeedback.comment })
        .from(eventFeedback)
        .where(eq(eventFeedback.userId, guest.id)),
    ).toEqual([{ comment: 'I am the one who brought the croissants' }]);
  });

  it("keeps the member's RSVPs and attendance, and their rating without its comment", async () => {
    const { db, host, joined } = await closedHostWithHistory();

    await eraseClosedAccount(db, {
      id: host.id,
      email: host.email,
      phoneNumber: null,
    });

    expect(
      await db
        .select({ eventId: eventRsvps.eventId })
        .from(eventRsvps)
        .where(eq(eventRsvps.userId, host.id)),
    ).toEqual([{ eventId: joined }]);
    expect(
      await db
        .select({ outcome: eventAttendance.outcome })
        .from(eventAttendance)
        .where(eq(eventAttendance.userId, host.id)),
    ).toEqual([{ outcome: 'attended' }]);
    expect(
      await db
        .select({
          rating: eventFeedback.valueRating,
          comment: eventFeedback.comment,
          language: eventFeedback.commentLanguage,
        })
        .from(eventFeedback)
        .where(eq(eventFeedback.userId, host.id)),
    ).toEqual([{ rating: 'valuable', comment: null, language: null }]);
  });

  it('takes only codes and waitlist entries for this address, not one that looks like it', async () => {
    const { db, host } = await closedHostWithHistory();
    const lookalike = host.email.replace('_', 'x');
    await db.insert(verification).values({
      id: id('ver'),
      identifier: `change-email-otp-${lookalike}-next@closing.test`,
      value: 'hashed:0',
      expiresAt: NOW,
    });
    await db.insert(cityWaitlist).values({
      id: id('wtl'),
      email: lookalike,
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'fr',
    });

    await eraseClosedAccount(db, {
      id: host.id,
      email: host.email,
      phoneNumber: null,
    });

    const codes = await db.select().from(verification);
    expect(codes.map((row) => row.identifier)).toContain(
      `change-email-otp-${lookalike}-next@closing.test`,
    );
    expect(
      await db
        .select()
        .from(cityWaitlist)
        .where(eq(cityWaitlist.email, lookalike)),
    ).toHaveLength(1);
  });

  it('leaves an account that was reopened exactly as it was', async () => {
    const { db, host } = await closedHostWithHistory();
    await db
      .update(user)
      .set({ accountState: 'active', closedAt: null })
      .where(eq(user.id, host.id));
    const before = await rowsFor(db, host.id);

    expect(
      await eraseClosedAccount(db, {
        id: host.id,
        email: host.email,
        phoneNumber: null,
      }),
    ).toBe(false);

    expect(await rowsFor(db, host.id)).toEqual(before);
    const [row] = await db.select().from(user).where(eq(user.id, host.id));
    expect(row).toMatchObject({ email: host.email, accountState: 'active' });
  });
});
