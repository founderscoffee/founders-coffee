import { describe, expect, it } from 'vitest';

import { verifyEventSession } from './session.js';

const dbFor = (row: Record<string, unknown> | null) => {
  const statement = {
    bind: () => statement,
    first: async <T>() => row as T | null,
  };
  return { prepare: () => statement };
};

describe('verifyEventSession', () => {
  it('rejects a missing session', async () => {
    await expect(
      verifyEventSession(dbFor(null), 'event-1', 'token'),
    ).resolves.toEqual({
      ok: false,
      reason: 'no_session',
    });
  });

  it('rejects a valid session without event membership', async () => {
    await expect(
      verifyEventSession(
        dbFor({
          user_id: 'user-1',
          name: 'Member',
          host_id: 'host-1',
          rsvpd: 0,
        }),
        'event-1',
        'token',
      ),
    ).resolves.toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('accepts a host session', async () => {
    await expect(
      verifyEventSession(
        dbFor({ user_id: 'host-1', name: 'Host', host_id: 'host-1', rsvpd: 0 }),
        'event-1',
        'token',
      ),
    ).resolves.toEqual({
      ok: true,
      userId: 'host-1',
      userName: 'Host',
      isHost: true,
      sessionToken: 'token',
    });
  });
});
