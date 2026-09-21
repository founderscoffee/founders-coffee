import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  enableOperations,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import {
  accountPreferences,
  eq,
  getEvent,
  scheduledNotifications,
  type Db,
} from '@founders-coffee/db';

import { enqueueCloseoutPrompt } from '../notifications/closeout-prompt.js';
import { submitCloseoutResolver } from './closeout.js';

const held = {
  outcome: 'held' as const,
  walkInCount: 0,
  wouldHostAgain: null,
  hostFriction: [],
};

describe('the nudge to close out, once the host has', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  const optInToFollowUps = (db_: Db, userId: string) =>
    db_
      .insert(accountPreferences)
      .values({ userId, followUpPrompts: true, followUpPromptsChannels: 4 })
      .onConflictDoUpdate({
        target: accountPreferences.userId,
        set: { followUpPrompts: true, followUpPromptsChannels: 4 },
      })
      .run();

  const noticesFor = (eventId: string) =>
    db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));

  const statusOf = async (eventId: string, templateKey: string) =>
    (await noticesFor(eventId))
      .filter((row) => row.templateKey === templateKey)
      .map((row) => row.status);

  const promptFor = async (eventId: string) => {
    const event = await getEvent(db, eventId);
    if (!event) throw new Error('fixture event missing');
    const outcome = await enqueueCloseoutPrompt(db, event);
    expect(
      outcome,
      'the prompt has to exist before this suite can prove it is retired',
    ).toBe('scheduled');
    expect(await statusOf(eventId, 'closeout_prompt')).toEqual(['pending']);
  };

  it('is retired when the gathering is closed out as held', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await promptFor(eventId);

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(
      await statusOf(eventId, 'closeout_prompt'),
      'the prompt fires at endsAt + 30 minutes and the window opens at endsAt, so a host who closes out promptly is nudged to do what they just did',
    ).toEqual(['cancelled']);
  });

  it('is retired when the host says it did not happen', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await promptFor(eventId);

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId, outcome: 'did_not_happen' },
      attendance: [],
    });

    expect(
      await statusOf(eventId, 'closeout_prompt'),
      'saying it did not happen is closing out too, and returns early — the cancel has to sit before that branch',
    ).toEqual(['cancelled']);
  });

  it('does not take the feedback invitations down with it', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await optInToFollowUps(db, MEMBER_ID);
    await promptFor(eventId);

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [{ userId: MEMBER_ID, outcome: 'attended' }],
    });

    const invitations = await statusOf(eventId, 'feedback_invitation');
    expect(
      invitations.length,
      'the closeout writes these on its way out; a scoped cancel is the whole point',
    ).toBeGreaterThan(0);
    expect(invitations.every((status) => status === 'pending')).toBe(true);
  });

  it('does not take the did-not-happen notices down with it', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await promptFor(eventId);

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId, outcome: 'did_not_happen' },
      attendance: [],
    });

    const notices = await statusOf(eventId, 'event_did_not_happen');
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.every((status) => status === 'pending')).toBe(true);
  });

  it('does not silence, on a resubmission, the invitations the first submission wrote', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await optInToFollowUps(db, MEMBER_ID);
    await promptFor(eventId);
    const submit = () =>
      submitCloseoutResolver(db, {
        actorId: HOST_ID,
        input: { ...held, eventId },
        attendance: [{ userId: MEMBER_ID, outcome: 'attended' }],
      });

    await submit();
    expect(await statusOf(eventId, 'feedback_invitation')).toEqual(['pending']);
    await submit();

    expect(
      await statusOf(eventId, 'feedback_invitation'),
      'the invitation carries a derived id and is re-enqueued ON CONFLICT DO NOTHING, so anything that cancels it on the way past cancels it for good',
    ).toEqual(['pending']);
  });

  it('leaves a prompt belonging to another gathering alone', async () => {
    const closed = await pastEvent(db, { attendees: [MEMBER_ID] });
    const untouched = await pastEvent(db, { attendees: [MEMBER_ID] });
    await promptFor(closed);
    await promptFor(untouched);

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId: closed },
      attendance: [],
    });

    expect(await statusOf(untouched, 'closeout_prompt')).toEqual(['pending']);
  });

  it('is retired on a resubmission that resumes the same closeout', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });
    await db
      .update(scheduledNotifications)
      .set({ status: 'pending' })
      .where(eq(scheduledNotifications.eventId, eventId))
      .run();
    await promptFor(eventId);

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(await statusOf(eventId, 'closeout_prompt')).toEqual(['cancelled']);
  });
});
