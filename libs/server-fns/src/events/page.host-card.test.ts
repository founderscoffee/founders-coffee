import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  enableOperations,
  eventRow,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import type { Db } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

import { submitCloseoutResolver } from '../operations/closeout.js';
import {
  readOwnerProfile,
  readPublicProfile,
  saveOwnerProfile,
} from '../profile/resolver.js';
import { readEventPage } from './page.js';

const heldMeetup = async (db: Db, hostId: string, attendeeId: string) => {
  const eventId = await pastEvent(db, { hostId, attendees: [attendeeId] });
  const closed = await submitCloseoutResolver(db, {
    actorId: hostId,
    input: {
      eventId,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
    },
    attendance: [{ userId: attendeeId, outcome: 'attended' }],
  });
  expect(closed.ok).toBe(true);
  return eventId;
};

const publishAttendance = async (db: Db, userId: string) => {
  const owner = await readOwnerProfile(db, userId);
  if (!owner.ok) throw new Error('The fixture member has no profile');
  const saved = await saveOwnerProfile(
    db,
    userId,
    profile.updateProfileSchema.parse({
      displayName: owner.data.displayName,
      expectedRevision: owner.data.revision,
      visibility: { attendedCount: true },
    }),
  );
  expect(saved.ok).toBe(true);
};

describe("the host's card on a meetup's page (#114)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it("is the host's public profile, with the meetups they hosted and attended", async () => {
    await heldMeetup(db, OTHER_ID, HOST_ID);
    await heldMeetup(db, OTHER_ID, HOST_ID);
    const eventId = await heldMeetup(db, HOST_ID, MEMBER_ID);
    await publishAttendance(db, HOST_ID);
    const event = await eventRow(db, eventId);
    if (!event) throw new Error('The fixture meetup was not created');

    const page = await readEventPage(
      db,
      { marketCode: event.marketCode, slug: event.slug },
      Promise.resolve(undefined),
    );
    const card = await readPublicProfile(db, HOST_ID);

    expect(page.ok && page.data.host).toMatchObject({
      userId: HOST_ID,
      hostedCount: 1,
      attendedCount: 2,
    });
    expect(page.ok && page.data.host).toEqual(card.ok && card.data);
  });
});
