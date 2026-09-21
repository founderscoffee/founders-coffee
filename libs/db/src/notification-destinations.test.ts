import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { getNotificationContact } from './notification-destinations.js';
import { seed } from './seed.js';
import { user } from './schema.js';

const memberWithNoPreferencesRow = async (suffix: string) => {
  const db = createDb(env.DB);
  await seed(db);
  const userId = `usr_dest_${suffix}`;
  await db
    .insert(user)
    .values({
      id: userId,
      name: 'Destination Member',
      email: `${userId}@test.coffee`,
    })
    .onConflictDoNothing()
    .run();
  return { db, userId };
};

describe('what a member with no preferences row is taken to want', () => {
  it('reads the same follow-up default the column would have written', async () => {
    const { db, userId } = await memberWithNoPreferencesRow('follow');

    const contact = await getNotificationContact(db, userId);

    expect(contact?.followUpPrompts).toBe(true);
    expect(contact?.followUpPromptsChannels).toBe(4);
  });

  it('keeps every other category on both channels, so email-only is follow-up alone', async () => {
    const { db, userId } = await memberWithNoPreferencesRow('others');

    const contact = await getNotificationContact(db, userId);

    expect(contact?.eventUpdatesChannels).toBe(5);
    expect(contact?.eventRemindersChannels).toBe(5);
    expect(contact?.hostRsvpReceivedChannels).toBe(5);
    expect(contact?.hostRsvpCancelledChannels).toBe(5);
  });
});
