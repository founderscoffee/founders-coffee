import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  enableOperations,
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
} from './resolver.js';

const closeOut = async (
  db: Db,
  outcome: 'held' | 'did_not_happen',
  attendance: readonly {
    userId: string;
    outcome: 'attended' | 'no_show';
  }[],
) => {
  const eventId = await pastEvent(db, {
    attendees: attendance.map((mark) => mark.userId),
  });
  const result = await submitCloseoutResolver(db, {
    actorId: HOST_ID,
    input: {
      eventId,
      outcome,
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
    },
    attendance,
  });
  expect(result.ok).toBe(true);
};

const publishAttendance = async (db: Db, userId: string, isPublic: boolean) => {
  const owner = await readOwnerProfile(db, userId);
  if (!owner.ok) throw new Error('The fixture member has no profile');
  const saved = await saveOwnerProfile(
    db,
    userId,
    profile.updateProfileSchema.parse({
      displayName: owner.data.displayName,
      expectedRevision: owner.data.revision,
      visibility: { attendedCount: isPublic },
    }),
  );
  expect(saved.ok).toBe(true);
};

const attendedCount = async (db: Db, userId: string) => {
  const result = await readPublicProfile(db, userId);
  if (!result.ok) throw new Error('The fixture member has no public profile');
  return result.data.attendedCount;
};

describe('meetups a member attended, on their public profile (#90)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('stays off the profile until the member publishes it', async () => {
    await publishAttendance(db, MEMBER_ID, false);
    await closeOut(db, 'held', [{ userId: MEMBER_ID, outcome: 'attended' }]);

    expect(await attendedCount(db, MEMBER_ID)).toBeNull();

    await publishAttendance(db, MEMBER_ID, true);
    expect(await attendedCount(db, MEMBER_ID)).toBe(1);

    await publishAttendance(db, MEMBER_ID, false);
    expect(await attendedCount(db, MEMBER_ID)).toBeNull();
  });

  it('counts what hosts recorded, and says nothing of a no-show even when published', async () => {
    await publishAttendance(db, MEMBER_ID, true);
    await publishAttendance(db, OTHER_ID, true);
    await closeOut(db, 'held', [
      { userId: MEMBER_ID, outcome: 'attended' },
      { userId: OTHER_ID, outcome: 'no_show' },
    ]);
    await closeOut(db, 'held', [
      { userId: MEMBER_ID, outcome: 'attended' },
      { userId: OTHER_ID, outcome: 'attended' },
    ]);

    expect(await attendedCount(db, MEMBER_ID)).toBe(2);
    expect(await attendedCount(db, OTHER_ID)).toBe(1);
    const published = JSON.stringify(await readPublicProfile(db, OTHER_ID));
    expect(published).not.toMatch(/no_show|noShow|missed/i);
  });

  it('leaves out a meetup the host said did not happen', async () => {
    await publishAttendance(db, MEMBER_ID, true);
    await closeOut(db, 'did_not_happen', [
      { userId: MEMBER_ID, outcome: 'attended' },
    ]);

    expect(await attendedCount(db, MEMBER_ID)).toBe(0);
  });
});
