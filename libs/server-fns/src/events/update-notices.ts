import { hasVenueMoved } from '@founders-coffee/core';
import {
  cancelNotificationsByTemplate,
  listGoingAttendees,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { reportError } from '@founders-coffee/observability';

import { enqueueRsvpNotifications } from '../notifications/producer.js';
import {
  enqueueEventChangeNotices,
  type EventChangeTemplateKey,
} from '../notifications/event-change.js';
import { announceTelegramUpdate } from '../telegram/notices.js';

const REARMED_TEMPLATES = ['reminder_72h', 'reminder_24h'] as const;

const scheduleMoved = (before: Event, after: Event): boolean =>
  before.startsAt.getTime() !== after.startsAt.getTime() ||
  (before.endsAt?.getTime() ?? null) !== (after.endsAt?.getTime() ?? null);

/**
 * Which single notice, if any, an edit owes the people who said they were coming.
 *
 * Two kinds of edit come out of an edit form. A quiet one changes the page and tells nobody:
 * wording, a café that renamed itself, a pin nudged onto the right doorway. A loud one reaches
 * every phone still going, and there are exactly two — the meetup starts at a different time, or it
 * is more than a block from where it was. Both are things a person who has planned their evening
 * around this has to hear.
 *
 * Neither is something they should hear twice. A host who moves the evening to Sunday and to a
 * different café has made one change of plan, not two, so at most one notice leaves per save and
 * the time takes precedence — its copy names the new venue as well, which is why it can stand for
 * both. The relocation notice exists only for the case the time notice cannot honestly cover: the
 * hour untouched and the place moved, where a push headed "new time" sends people looking for a
 * change that is not there.
 *
 * What counts as far enough to be somewhere else, and why a first pin on a meetup that never had
 * one is not a move at all, is `hasVenueMoved`'s to decide. The edit form asks it the same question,
 * so the warning a host reads before saving is the message their attendees get.
 */
export const noticeFor = (
  before: Event,
  after: Event,
  point: { latitude: number; longitude: number } | null,
): EventChangeTemplateKey | null => {
  if (scheduleMoved(before, after)) return 'event_rescheduled';
  if (point && hasVenueMoved(before, point)) return 'event_relocated';
  return null;
};

/**
 * Whether a queued reminder would now describe a meetup that no longer exists.
 *
 * Reminders are rendered when they are enqueued, not when they are sent: the row carries a finished
 * title, venue and date, so a pending one is a sentence written weeks ago and held. That makes a
 * quiet edit less quiet than it looks — correcting a misspelt café still leaves two messages queued
 * against the old spelling, and they go out days later contradicting the page they link to.
 *
 * Three fields reach a reminder's text, and the start also decides when it is sent, so any of them
 * changing means the queue has to be written again. Nothing else here does: the description is not
 * in a reminder, and neither is the address.
 */
const remindersWouldLie = (before: Event, after: Event): boolean =>
  scheduleMoved(before, after) ||
  before.title !== after.title ||
  before.venue !== after.venue;

/**
 * Write the reminders again from what the meetup now says.
 *
 * Reminders carry an absolute `sendAt` computed from the start they were written for, so a meetup
 * pushed from Friday to Sunday keeps a 24-hour reminder pointing at Thursday night — it would reach
 * people two days early, describing a time that is no longer true. The pending ones are withdrawn
 * and written again against the event as it now stands.
 *
 * The producer skips anyone who already has a pending row of that kind, which is why the withdrawal
 * has to happen first: re-arming over live rows would no-op and leave the stale ones in place. It
 * also refuses a reminder whose moment has already passed, so a meetup edited inside the last day
 * gets no second copy of one that has already gone out.
 */
const rearmReminders = async (db: Db, event: Event): Promise<void> => {
  await cancelNotificationsByTemplate(db, {
    eventId: event.id,
    templateKeys: [...REARMED_TEMPLATES],
  });
  for (const attendee of await listGoingAttendees(db, event.id)) {
    await enqueueRsvpNotifications(db, {
      eventId: event.id,
      userId: attendee.userId,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt: event.startsAt,
      venue: event.venue,
      phoneNumber: attendee.phoneNumber,
      email: attendee.email,
      locale: attendee.localePref,
      remindersOnly: true,
    });
  }
};

/**
 * Tell the meetup's Telegram group about the edit, whatever becomes of the members' notices.
 *
 * The group decides for itself what an edit changes, since its pinned details also carry the
 * address and the end, which no personal reminder does. A failure is reported and goes no further:
 * a group that could not be told must not keep a member's phone from hearing about a new time.
 */
const announceToTelegramGroup = async (
  db: Db,
  opts: {
    before: Event;
    after: Event;
    notice: EventChangeTemplateKey | null;
  },
): Promise<void> => {
  try {
    await announceTelegramUpdate(db, opts);
  } catch (error) {
    reportError(error, {
      operation: 'update_event_telegram',
      eventId: opts.after.id,
    });
  }
};

/**
 * Bring every queued and outgoing message into line with the edit that just landed.
 *
 * The order matters, and mirrors the cancellation path: the stale reminders are withdrawn and
 * rewritten before the notice goes out, so nothing already queued can arrive afterwards still
 * describing the old plan. The rewrite runs for quiet edits too — a reminder renders its text when
 * it is queued and would otherwise keep repeating a title the host has since corrected. The
 * meetup's Telegram group is told first, on its own terms.
 *
 * A failure here does not roll the edit back, which is why it is caught rather than thrown. The new
 * time is the true one the moment it is written, and refusing the edit to preserve an
 * all-or-nothing story would leave the host staring at the wrong time with no way to fix it. The
 * failure is reported and the count returned, so a caller can tell "nobody to tell" from "could not
 * tell anyone".
 */
export const announceUpdate = async (
  db: Db,
  opts: {
    before: Event;
    after: Event;
    notice: EventChangeTemplateKey | null;
  },
): Promise<number> => {
  await announceToTelegramGroup(db, opts);
  const rewrite = remindersWouldLie(opts.before, opts.after);
  if (!rewrite && !opts.notice) return 0;

  try {
    if (rewrite) await rearmReminders(db, opts.after);
    if (!opts.notice) return 0;
    return await enqueueEventChangeNotices(db, {
      eventId: opts.after.id,
      hostId: opts.after.hostId,
      eventTitle: opts.after.title,
      eventSlug: opts.after.slug,
      marketCode: opts.after.marketCode,
      startsAt: opts.after.startsAt,
      venue: opts.after.venue,
      venueAddress: opts.after.venueAddress,
      templateKey: opts.notice,
    });
  } catch (error) {
    reportError(error, {
      operation: 'update_event_notices',
      eventId: opts.after.id,
    });
    return 0;
  }
};
