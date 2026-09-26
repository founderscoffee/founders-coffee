import { describe, expect, it } from 'vitest';

import { id, shortId } from '@founders-coffee/core';
import { eq, scheduledNotifications, user } from '@founders-coffee/db';

import { notificationBaseUrl } from './context.js';
import { enqueueRsvpNotifications } from './producer.js';
import { seedEvent, setupDb } from './producer.fixtures.js';

const rsvpFor = async (locale: 'ar' | 'fr' | 'en') => {
  const db = await setupDb();
  const event = await seedEvent(db);
  const memberId = id('usr');
  const email = `${memberId}@producer.test`;
  await db
    .insert(user)
    .values({
      id: memberId,
      name: 'Member',
      email,
      emailVerified: true,
      role: 'member',
    })
    .run();

  await enqueueRsvpNotifications(db, {
    eventId: event.id,
    userId: memberId,
    eventTitle: 'Coffee + Code',
    eventSlug: event.slug,
    marketCode: 'DZ',
    startsAt: new Date('2099-01-15T23:30:00Z'),
    venue: 'Café des Délices, Hydra',
    email,
    locale,
  });

  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, event.id));
  return {
    eventId: event.id,
    emails: rows.map((row) => ({
      templateKey: row.templateKey,
      ...(row.payload as { html: string; text: string }),
    })),
  };
};

describe('the RSVP confirmation email offers the meetup to a calendar (#21)', () => {
  it('links both calendars on this deployment, in the language the member is written to in', async () => {
    const { eventId, emails } = await rsvpFor('fr');
    const confirmation = emails.find(
      (email) => email.templateKey === 'rsvp_confirmation',
    );
    const ics = `${notificationBaseUrl()}/cal/e/${shortId(eventId)}?l=fr`;

    expect(confirmation?.html).toContain(`href="${ics}&amp;to=google"`);
    expect(confirmation?.html).toContain(`href="${ics}"`);
    expect(confirmation?.text).toContain(`${ics}&to=google\n`);
    expect(confirmation?.text.endsWith(ics)).toBe(true);
  });

  it('leaves the reminders as they were', async () => {
    const { emails } = await rsvpFor('en');
    const reminders = emails.filter(
      (email) => email.templateKey !== 'rsvp_confirmation',
    );

    expect(reminders.map((email) => email.templateKey).sort()).toEqual([
      'reminder_24h',
      'reminder_72h',
    ]);
    for (const reminder of reminders) {
      expect(reminder.html).not.toContain('/cal/e/');
      expect(reminder.text).not.toContain('/cal/e/');
    }
  });
});
