import { describe, expect, it } from 'vitest';

import {
  refusalFor,
  verifyEventSession,
  verifyEventSessionFromCookie,
} from './session.js';

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

describe('verifyEventSessionFromCookie', () => {
  it('uses the unsigned token from a signed session cookie', async () => {
    await expect(
      verifyEventSessionFromCookie(
        dbFor({
          user_id: 'host-1',
          name: 'Host',
          host_id: 'host-1',
          rsvpd: 0,
        }),
        'event-1',
        new Request('https://example.com', {
          headers: {
            cookie: 'better-auth.session_token=session-token.signature',
          },
        }),
      ),
    ).resolves.toEqual({
      ok: true,
      userId: 'host-1',
      userName: 'Host',
      isHost: true,
      sessionToken: 'session-token',
    });
  });
});

describe('how a refusal is told to the browser', () => {
  it('does not call a signed-in non-attendee an expired session', () => {
    const notAllowed = refusalFor('not_allowed');
    const noSession = refusalFor('no_session');

    expect(notAllowed.message.type).toBe('not_attending');
    expect(noSession.message.type).toBe('auth_expired');
    expect(notAllowed.message.type).not.toBe(noSession.message.type);
  });

  it('closes both refusals, with a code that says which one it was', () => {
    expect(refusalFor('not_allowed').close?.code).toBe(4003);
    expect(refusalFor('no_session').close?.code).toBe(4001);
  });

  it('leaves a database failure open, because retrying is the right answer', () => {
    const transient = refusalFor('db_error');

    expect(transient.message.type).toBe('error');
    expect(transient.close).toBeNull();
  });
});
