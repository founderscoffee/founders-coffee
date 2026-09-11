import {
  and,
  eq,
  eventRsvps,
  listAttendance,
  user,
  type Db,
} from '@founders-coffee/db';

export interface RosterMember {
  readonly userId: string;
  readonly name: string;
  readonly outcome: 'attended' | 'no_show' | null;
}

/**
 * The people a host may mark, and what they were marked as.
 *
 * Built from the RSVP table rather than from anything the browser sends. §5.4 scopes registered
 * attendance to members who said they were coming, and the form that collects it must be built from
 * the same set the write will accept — otherwise a host is offered a name the guard will refuse, or
 * a forged list arrives and is only caught one row at a time.
 *
 * The RSVP freeze is what makes this stable: intent is frozen at `startsAt`, so the roster a host
 * sees after the event is the roster that existed when it began, and cannot be changed by anyone
 * cancelling afterwards.
 *
 * Existing marks are joined in rather than fetched separately, so reopening the form shows what was
 * already recorded instead of an empty slate that would overwrite it.
 */
export const listCloseoutRoster = async (
  db: Db,
  opts: { eventId: string },
): Promise<RosterMember[]> => {
  const rows = await db
    .select({
      userId: eventRsvps.userId,
      name: user.name,
    })
    .from(eventRsvps)
    .innerJoin(user, eq(user.id, eventRsvps.userId))
    .where(
      and(eq(eventRsvps.eventId, opts.eventId), eq(eventRsvps.status, 'going')),
    )
    .orderBy(user.name);

  const marked = new Map(
    (await listAttendance(db, opts.eventId)).map((row) => [
      row.userId,
      row.outcome,
    ]),
  );

  return rows.map((row) => ({
    ...row,
    outcome: marked.get(row.userId) ?? null,
  }));
};
