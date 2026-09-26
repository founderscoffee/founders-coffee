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
    all: async <T>() => ({ results: (row ? [row] : []) as T[] }),
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
            cookie:
              '__Secure-better-auth.session_token=session-token.signature',
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
    const notAllowed = refusalFor('not_allowed', { isVerified: false });
    const noSession = refusalFor('no_session', { isVerified: false });

    expect(notAllowed.message.type).toBe('not_attending');
    expect(noSession.message.type).toBe('auth_expired');
    expect(notAllowed.message.type).not.toBe(noSession.message.type);
  });

  it('closes both refusals, with a code that says which one it was', () => {
    for (const isVerified of [false, true]) {
      expect(refusalFor('not_allowed', { isVerified }).close?.code).toBe(4003);
      expect(refusalFor('no_session', { isVerified }).close?.code).toBe(4001);
    }
  });

  it('leaves a verified socket open on a database failure, which says nothing about its session', () => {
    const transient = refusalFor('db_error', { isVerified: true });

    expect(transient.message.type).toBe('error');
    expect(transient.close).toBeNull();
  });

  it('asks a joining socket to try again on a database failure, rather than hold it unverified', () => {
    const transient = refusalFor('db_error', { isVerified: false });

    expect(transient.message.type).toBe('error');
    expect(transient.close).toEqual({ code: 1013, reason: 'try_again_later' });
  });
});
