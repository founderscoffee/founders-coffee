import type { EventConnections } from './connections.js';
import type { EventRoster } from './roster.js';
import type { ClientMessage } from './protocol.js';

type LiveAction = Exclude<ClientMessage, { type: 'auth' | 'heartbeat' }>;

export const handleLiveAction = async (args: {
  ws: WebSocket;
  message: LiveAction;
  connections: EventConnections;
  roster: EventRoster;
}): Promise<void> => {
  const { ws, message, connections, roster } = args;
  const connection = connections.get(ws);
  if (!connection?.authenticated) {
    connections.send(ws, { type: 'error', message: 'Not authenticated' });
    return;
  }

  switch (message.type) {
    case 'arrived':
      if (connection.isHost && roster.getHost()) {
        await roster.markHostArrived(message);
        connections.broadcast({
          type: 'host_update',
          host: roster.getHost() ?? undefined,
        });
        connections.broadcast({
          type: 'roster_update',
          roster: roster.toRoster(),
        });
      } else if (await roster.setAttendeeStatus(connection.userId, 'arrived')) {
        connections.broadcast({
          type: 'roster_update',
          roster: roster.toRoster(),
        });
      }
      return;
    case 'walking_in':
      await updateAttendee(
        connections,
        roster,
        connection.userId,
        'walking_in',
      );
      return;
    case 'running_late':
      await updateAttendee(
        connections,
        roster,
        connection.userId,
        'running_late',
        message.etaMinutes,
      );
      return;
    case 'table_pin':
      if (connection.isHost && roster.getHost()) {
        await roster.pinTable(message.tableNumber);
        connections.broadcast({
          type: 'host_update',
          host: roster.getHost() ?? undefined,
        });
      } else {
        connections.send(ws, {
          type: 'error',
          message: 'Only the host can pin tables',
        });
      }
      return;
  }
};

const updateAttendee = async (
  connections: EventConnections,
  roster: EventRoster,
  userId: string,
  status: 'walking_in' | 'running_late',
  etaMinutes?: number,
): Promise<void> => {
  if (await roster.setAttendeeStatus(userId, status, etaMinutes)) {
    connections.broadcast({ type: 'roster_update', roster: roster.toRoster() });
  }
};
