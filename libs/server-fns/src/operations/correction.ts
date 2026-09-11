import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import { correctCloseout, getEvent, type Db } from '@founders-coffee/db';
import type { operations } from '@founders-coffee/domain';

/**
 * Rewrite a closeout an operator has decided is wrong.
 *
 * The one path that bypasses "only the host may submit", and the reason the permission is
 * `closeout:override` rather than anything a host holds: this changes the record of whether a
 * gathering happened, which every attendance figure and trust signal is derived from.
 *
 * The caller's permission is **not** checked here. It is checked by the admin surface that reaches
 * this, because that is the origin Cloudflare Access stands in front of and where the correlated
 * operator identity exists — a member-facing server function must never be able to call this, and
 * the way to guarantee that is to keep it out of the public `apps/ui` barrel rather than to add a
 * role comparison a caller could be wired around.
 *
 * `expectedVersion` is the concurrency guard: two operators correcting the same closeout without it
 * is last-write-wins over evidence. A stale version is reported rather than merged, because merging
 * two disagreeing accounts of the same evening produces a third that nobody asserted.
 *
 * The reason is required by the schema and lands in the audit entry, so a correction is never
 * anonymous.
 */
export const correctCloseoutResolver = async (
  db: Db,
  opts: {
    actorId: string;
    accessSubject?: string | null;
    input: operations.CorrectCloseoutInput;
  },
): Promise<Result<{ version: number }>> => {
  const event = await getEvent(db, opts.input.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));

  const result = await correctCloseout(db, {
    eventId: opts.input.eventId,
    expectedVersion: opts.input.expectedVersion,
    actorId: opts.actorId,
    accessSubject: opts.accessSubject ?? null,
    outcome: opts.input.outcome,
    walkInCount: opts.input.walkInCount,
    wouldHostAgain: opts.input.wouldHostAgain,
    hostFriction: opts.input.hostFriction,
    reason: opts.input.reason,
    auditId: id('aud'),
  });

  if (result.outcome === 'stale_version')
    return err(
      new AppError(
        'closeout_stale_version',
        'Somebody else changed this closeout first',
      ),
    );
  if (result.outcome === 'not_closed')
    return err(
      new AppError(
        'closeout_not_closed',
        'This gathering has no closeout to correct',
      ),
    );

  return ok({ version: result.row?.version ?? opts.input.expectedVersion + 1 });
};
