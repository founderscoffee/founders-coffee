import { beforeEach, describe, expect, it } from 'vitest';

import {
  MEMBER_ID,
  setPreferences,
  setupDb,
} from './notification-sweep.fixtures.js';
import { resolveDestination } from './notification-destination.js';

describe('host and follow-up notification category gates', () => {
  let db: Awaited<ReturnType<typeof setupDb>>;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('refuses a host cancellation notice when cancellation notices are off', async () => {
    await setPreferences(db, { hostRsvpCancelled: false });

    const result = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_cancelled',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('host_rsvp_cancelled_off');
      expect(result.account).toBe(true);
    }
  });

  it('enforces confirmation and cancellation notices independently', async () => {
    await setPreferences(db, { hostRsvpReceived: false });

    const receivedOff = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_received',
    );
    const cancelledOn = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_cancelled',
    );

    await setPreferences(db, {
      hostRsvpReceived: true,
      hostRsvpCancelled: false,
    });

    const receivedOn = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_received',
    );
    const cancelledOff = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_cancelled',
    );

    expect(receivedOff.ok).toBe(false);
    expect(cancelledOn.ok).toBe(true);
    expect(receivedOn.ok).toBe(true);
    expect(cancelledOff.ok).toBe(false);
  });

  it('enforces the follow-up switch for feedback invitations', async () => {
    await setPreferences(db, { followUpPrompts: false });
    const off = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'feedback_invitation',
      'DZ',
    );
    await setPreferences(db, { followUpPrompts: true });
    const on = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'feedback_invitation',
      'DZ',
    );

    expect(off.ok).toBe(false);
    if (!off.ok) {
      expect(off.reason).toBe('follow_up_prompts_off');
      expect(off.account).toBe(true);
    }
    expect(on.ok).toBe(true);
  });
});
