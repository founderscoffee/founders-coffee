import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  getAccountSummary,
  listOwnedSessions,
  findOwnedSessionByToken,
  revokeOwnedSessions,
  unlinkProviderIfNotLast,
  type Db,
} from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import { logger } from '@founders-coffee/observability';

/**
 * The session token inside a cookie header, without the signature Better Auth appends.
 *
 * The stored row holds the token alone, so the `.signature` suffix has to come off or nothing ever
 * matches and every device looks like somebody else's. Written here rather than inline in the RPC
 * because getting it wrong is invisible — the list still renders, just with no current device
 * marked and revoke-others quietly ending the caller's own session too.
 */
export const sessionTokenFromCookie = (
  cookie: string | null,
): string | null => {
  const match = (cookie ?? '').match(/(?:^|;\s*)[^=;]*session_token=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]).split('.')[0];
  return value === '' ? null : value;
};

export interface SessionSummary {
  readonly id: string;
  readonly isCurrent: boolean;
  readonly userAgent: string | null;
  readonly startedAt: number;
}

export interface DeviceList {
  readonly sessions: readonly SessionSummary[];
  readonly providers: readonly profile.AccountProvider[];
}

/**
 * The member's own devices, named by an id that is worth nothing to anyone else.
 *
 * The session token never leaves the server: it is the credential itself, and a list of a member's
 * devices that carries one is a list of ways to become them. The row id goes instead, and every
 * action that takes an id checks ownership in the same statement that acts on it, so the id is
 * inert even if it leaks.
 *
 * The current device is marked by matching the caller's own token to a row here rather than by
 * echoing anything the client sent — a client that could nominate its own "current" session could
 * nominate somebody else's and keep it while revoking the rest.
 */
export const readDevices = async (
  db: Db,
  userId: string,
  sessionToken: string | null,
): Promise<Result<DeviceList>> => {
  try {
    const [rows, summary, currentId] = await Promise.all([
      listOwnedSessions(db, userId),
      getAccountSummary(db, userId),
      sessionToken
        ? findOwnedSessionByToken(db, userId, sessionToken)
        : Promise.resolve(null),
    ]);
    return ok({
      sessions: rows.map((row) => ({
        id: row.id,
        isCurrent: row.id === currentId,
        userAgent: row.userAgent,
        startedAt: row.createdAt.getTime(),
      })),
      providers: profile.knownAccountProviders(summary?.providerIds ?? []),
    });
  } catch {
    logger.error('devices_unavailable', { userId });
    return err(new AppError('account_unavailable', 'Devices are unavailable'));
  }
};

/** End one named device, or every device except the one asking. */
export const revokeDevices = async (
  db: Db,
  userId: string,
  input: { sessionId?: string; othersOnly?: boolean },
  sessionToken: string | null,
): Promise<Result<{ revoked: number }>> => {
  const currentId = sessionToken
    ? await findOwnedSessionByToken(db, userId, sessionToken)
    : null;
  const owned = await listOwnedSessions(db, userId);
  const targets = input.othersOnly
    ? owned.filter((row) => row.id !== currentId).map((row) => row.id)
    : owned.filter((row) => row.id === input.sessionId).map((row) => row.id);

  if (targets.length === 0)
    return err(new AppError('not_found', 'No such device'));

  const revoked = await revokeOwnedSessions(db, userId, targets);
  logger.info('devices_revoked', { userId, revoked });
  return ok({ revoked });
};

/**
 * How many ways in the member would still have with one provider gone.
 *
 * An email address is always one of them: signing in with a code sent to it needs no stored
 * credential, so it survives every unlink. A verified phone is a second. The count exists so the
 * rule is stated where it can be read, rather than being an accident of which providers happen to
 * exist — and so it still holds if an identity without an email ever becomes possible.
 */
const otherWaysIn = (summary: {
  email: string;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}): number =>
  (summary.email ? 1 : 0) +
  (summary.phoneNumber && summary.phoneNumberVerified ? 1 : 0);

/** Disconnect a sign-in provider, unless it is the only way the member could get back in. */
export const unlinkProvider = async (
  db: Db,
  userId: string,
  providerId: string,
): Promise<Result<{ unlinked: true }>> => {
  const summary = await getAccountSummary(db, userId);
  if (!summary) return err(new AppError('not_found', 'Account not found'));

  const removed = await unlinkProviderIfNotLast(db, {
    userId,
    providerId,
    otherMethods: otherWaysIn(summary),
  });
  if (!removed) {
    logger.warn('provider_unlink_refused', { userId, providerId });
    return err(new AppError('last_sign_in_method', 'Keep one way to sign in'));
  }
  return ok({ unlinked: true });
};
