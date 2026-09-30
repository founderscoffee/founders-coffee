import {
  HEARTBEAT_ACK_FRAME,
  HEARTBEAT_FRAME,
  HEARTBEAT_TIMEOUT_MS,
  ROOM_HEARTBEAT_TIMEOUT_CLOSE,
} from '@founders-coffee/core';

import type {
  RoomConnection,
  RoomConnections,
  RoomMember,
} from './connections.js';

/**
 * Have the runtime answer a room's heartbeats itself.
 *
 * The runtime answers `HEARTBEAT_FRAME` with `HEARTBEAT_ACK_FRAME` without waking the room, and
 * stamps when it did (#85), but only on an exact match. Both frames keep the JSON text the live
 * room used to exchange itself, so a page loaded before the runtime took over is answered just as
 * it expects.
 */
export const answerHeartbeats = (ctx: DurableObjectState): void => {
  ctx.setWebSocketAutoResponse(
    new WebSocketRequestResponsePair(HEARTBEAT_FRAME, HEARTBEAT_ACK_FRAME),
  );
};

/**
 * Close the sockets that stopped sending heartbeats, and name the connections that went with them.
 */
export const reapStale = <Member extends RoomMember, Frame>(
  connections: RoomConnections<Member, Frame>,
  now: number,
): readonly RoomConnection<Member>[] => {
  const reaped: RoomConnection<Member>[] = [];
  for (const ws of connections.stale(now, HEARTBEAT_TIMEOUT_MS)) {
    const connection = connections.get(ws);
    if (connection) reaped.push(connection);
    connections.close(
      ws,
      ROOM_HEARTBEAT_TIMEOUT_CLOSE.code,
      ROOM_HEARTBEAT_TIMEOUT_CLOSE.reason,
    );
  }
  return reaped;
};

/**
 * Set the alarm for the earliest moment a socket in the room could go stale, or clear it when the
 * room is empty.
 *
 * That moment is the oldest last sign of life in the room, as it stands when the alarm is armed,
 * plus `HEARTBEAT_TIMEOUT_MS` (#86). Heartbeats are answered by the runtime and never wake the
 * room (#85), so the alarm cannot move later as they arrive: it fires at a deadline worked out on
 * an earlier wake. By then every healthy socket has sent a heartbeat within the last interval, so
 * the next deadline is 30 to 45 s away, and a healthy room wakes that often rather than every
 * 15 s. Arming any later would let a socket that went silent outlive the timeout. An alarm
 * already set sooner is kept, so a socket that joins never delays one that is due first.
 */
export const armHeartbeat = async <Member extends RoomMember, Frame>(
  storage: DurableObjectStorage,
  connections: RoomConnections<Member, Frame>,
): Promise<void> => {
  const next = connections.nextDeadline(HEARTBEAT_TIMEOUT_MS);
  if (next === null) {
    await storage.deleteAlarm();
    return;
  }
  const current = await storage.getAlarm();
  if (current === null || current > next) await storage.setAlarm(next);
};
