import type { EventConnections } from './connections.js';
import {
  refusalFor,
  verifyEventSession,
  verifyEventSessions,
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

/**
 * Check one connection's session before a message that changes the room is applied.
 *
 * Its refusals are the upgrade's, so a member whose RSVP was withdrawn hears `not_attending` here
 * as they would on joining, not that their session expired.
 */
export const revalidateConnection = async (args: {
  db: D1Db;
  eventId: string;
  ws: WebSocket;
  connections: EventConnections;
}): Promise<boolean> => {
  const { db, eventId, ws, connections } = args;
  const connection = connections.get(ws);
  if (!connection?.authenticated || !connection.sessionToken) return true;

  const result = await verifyEventSession(db, eventId, connection.sessionToken);
  if (result.ok) {
    connections.authenticate(ws, result);
    return true;
  }
  refuseConnection(connections, ws, result.reason);
  return false;
};

/**
 * Check every authenticated connection in the room with one query, and turn out those that no
 * longer hold (#87).
 *
 * A database failure turns nobody out. The question is asked again at the next alarm.
 */
export const revalidateConnections = async (args: {
  db: D1Db;
  eventId: string;
  connections: EventConnections;
}): Promise<void> => {
  const { db, eventId, connections } = args;
  const authenticated = connections
    .entries()
    .filter(
      ([, connection]) => connection.authenticated && connection.sessionToken,
    );
  if (authenticated.length === 0) return;

  const verdicts = await verifyEventSessions(
    db,
    eventId,
    authenticated.map(([, connection]) => connection.sessionToken),
  );
  for (const [ws, connection] of authenticated) {
    const verdict = verdicts.get(connection.sessionToken);
    if (verdict && !verdict.ok && verdict.reason !== 'db_error')
      refuseConnection(connections, ws, verdict.reason);
  }
};
