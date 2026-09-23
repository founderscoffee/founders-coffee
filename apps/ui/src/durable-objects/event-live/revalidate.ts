import type { EventConnections } from './connections.js';
import {
  refusalFor,
  verifyEventSession,
  type D1Db,
  type RefusalReason,
} from './session.js';

/**
 * Tell the browser why its connection is refused, then close it if `refusalFor` says to.
 *
 * Closing goes through `EventConnections.close`, which forgets the socket before closing it. A
 * refusal that closed the socket directly left it in the room's map (#84).
 */
export const refuseConnection = (
  connections: EventConnections,
  ws: WebSocket,
  reason: RefusalReason,
): void => {
  const refusal = refusalFor(reason);
  connections.send(ws, refusal.message);
  if (refusal.close)
    connections.close(ws, refusal.close.code, refusal.close.reason);
};

export const revalidateConnection = async (args: {
  db: D1Db;
  eventId: string;
  ws: WebSocket;
  connections: EventConnections;
  now: number;
}): Promise<boolean> => {
  const { db, eventId, ws, connections, now } = args;
  const connection = connections.get(ws);
  if (!connection?.authenticated || !connection.sessionToken) return true;

  const result = await verifyEventSession(db, eventId, connection.sessionToken);
  if (result.ok) {
    connections.authenticate(ws, result, now);
    return true;
  }
  if (result.reason === 'db_error') {
    connections.touch(ws, now);
    connections.send(ws, {
      type: 'error',
      message: 'Temporary auth error, please retry',
    });
    return false;
  }

  connections.send(ws, {
    type: 'auth_expired',
    message:
      result.reason === 'not_allowed'
        ? 'Not invited to this event'
        : 'Session expired',
  });
  connections.close(ws, 4001, 'auth_expired');
  return false;
};
