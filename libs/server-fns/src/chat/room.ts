import { DURABLE_OBJECT_LOCATION_HINT } from '@founders-coffee/infra';
import { reportError } from '@founders-coffee/observability';

import { workerEnv } from '../env.js';
import type { EventChatDO } from './room-do.js';
import { chatRoomName } from './room-path.js';

export type ChatRoomStub = DurableObjectStub<EventChatDO>;

/**
 * The room of a meetup's chat, or `null` in a Worker that has no binding to it.
 *
 * The UI Worker holds the rooms. The jobs Worker does not, so what it does to a meetup, such as the
 * nightly account closure's cancellations, reaches a room through its heartbeat check alone: within
 * `HEARTBEAT_TIMEOUT_MS`, a member who is no longer one is turned out, and the room of a meetup
 * that was cancelled closes.
 * Every room is created under the `weur` location hint, as the live rooms are (#88).
 */
export const chatRoomOf = (eventId: string): ChatRoomStub | null => {
  const namespace = workerEnv().EVENT_CHAT as
    DurableObjectNamespace<EventChatDO> | undefined;
  if (!namespace) return null;
  return namespace.get(namespace.idFromName(chatRoomName(eventId)), {
    locationHint: DURABLE_OBJECT_LOCATION_HINT,
  });
};

/**
 * Tell the room of a meetup's chat what just happened, for the members who have it open.
 *
 * D1 is the record and the room only a courtesy to open panels, so a room that cannot be reached
 * costs nothing that was written: the failure is reported, and a panel that missed the push reads
 * what it missed when it next reconnects.
 */
export const tellChatRoom = async (
  eventId: string,
  operation: string,
  tell: (room: ChatRoomStub) => Promise<unknown>,
): Promise<void> => {
  const room = chatRoomOf(eventId);
  if (!room) return;
  try {
    await tell(room);
  } catch (error) {
    reportError(error, { operation, eventId });
  }
};
