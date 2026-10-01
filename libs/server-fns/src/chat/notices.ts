import {
  postChatSystemMessage,
  type Db,
  type Event,
} from '@founders-coffee/db';
import type { chat } from '@founders-coffee/domain';
import { reportError } from '@founders-coffee/observability';

import { tellChatRoom } from './room.js';

/** What a meetup's chat is told when its start moves: the new start, and where it is. */
export const rescheduledNotice = (event: Event): chat.ChatSystemNotice => ({
  key: 'rescheduled',
  params: { startsAt: event.startsAt.toISOString(), venue: event.venue },
});

/**
 * What a meetup's chat is told when it moves somewhere else at the same time: the venue, and its
 * address when the host gave one that says more than the venue does. The address is where the move
 * shows, since a host who drops a pin across town can keep the café's name.
 */
export const relocatedNotice = (event: Event): chat.ChatSystemNotice => {
  const address = event.venueAddress?.trim();
  return {
    key: 'relocated',
    params: {
      venue: event.venue,
      ...(address && address !== event.venue ? { address } : {}),
    },
  };
};

/** What a meetup's chat is told when it is called off, with the host's reason when they gave one. */
export const cancelledNotice = (
  reason: string | undefined,
): chat.ChatSystemNotice => ({
  key: 'cancelled',
  params: reason ? { reason } : {},
});

/** A notice's parameters as the chat stores them, a JSON object of strings. */
const storedParams = (
  params: chat.ChatSystemNotice['params'],
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

/**
 * Tell a meetup's chat what just happened to the meetup, and push the notice to the members with
 * the chat open.
 *
 * The notice is a system message, stored as its key and parameters and read by each member in their
 * own language, where the change itself was made: an edit, a host's cancellation, or one the nightly
 * account closure made for a closing host. Nothing here can undo that change, so a failure is
 * reported and goes no further, and a chat its market has not switched on is told nothing.
 */
export const postChatNotice = async (
  db: Db,
  eventId: string,
  notice: chat.ChatSystemNotice,
): Promise<void> => {
  try {
    const message = await postChatSystemMessage(db, {
      eventId,
      systemKey: notice.key,
      systemParams: storedParams(notice.params),
    });
    if (!message) return;
    await tellChatRoom(eventId, 'chat_push_notice', (room) =>
      room.broadcast({ type: 'message', message }),
    );
  } catch (error) {
    reportError(error, {
      operation: 'chat_notice',
      eventId,
      notice: notice.key,
    });
  }
};
