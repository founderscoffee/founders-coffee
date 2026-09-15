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

  it('refuses a host cancellation notice when host updates are off', async () => {
    await setPreferences(db, { hostUpdates: false });

    const result = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_cancelled',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('host_updates_off');
      expect(result.account).toBe(true);
    }
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
