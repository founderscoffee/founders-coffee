import type { RoomConnections } from '@founders-coffee/server-fns/rooms';

import type { EventRoster } from './roster.js';
import type { ClientMessage, OutboundMessage } from './protocol.js';
import type { LiveMember } from './session.js';

type LiveAction = Exclude<ClientMessage, { type: 'auth' }>;

type LiveConnections = RoomConnections<LiveMember, OutboundMessage>;

export const handleLiveAction = async (args: {
  ws: WebSocket;
  message: LiveAction;
  connections: LiveConnections;
  roster: EventRoster;
}): Promise<void> => {
  const { ws, message, connections, roster } = args;
  const member = connections.get(ws)?.member;
  if (!member) {
    connections.send(ws, { type: 'error', message: 'Not authenticated' });
    return;
  }

  switch (message.type) {
    case 'arrived':
      if (member.isHost && roster.getHost()) {
        await roster.markHostArrived(message);
        connections.broadcast({
          type: 'host_update',
          host: roster.getHost() ?? undefined,
        });
        connections.broadcast({
          type: 'roster_update',
          roster: roster.toRoster(),
        });
      } else if (await roster.setAttendeeStatus(member.userId, 'arrived')) {
        connections.broadcast({
          type: 'roster_update',
          roster: roster.toRoster(),
        });
      }
      return;
    case 'walking_in':
      await updateAttendee(connections, roster, member.userId, 'walking_in');
      return;
    case 'running_late':
      await updateAttendee(
        connections,
        roster,
        member.userId,
        'running_late',
        message.etaMinutes,
      );
      return;
    case 'table_pin':
      if (member.isHost && roster.getHost()) {
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
  connections: LiveConnections,
  roster: EventRoster,
  userId: string,
  status: 'walking_in' | 'running_late',
  etaMinutes?: number,
): Promise<void> => {
  if (await roster.setAttendeeStatus(userId, status, etaMinutes)) {
    connections.broadcast({ type: 'roster_update', roster: roster.toRoster() });
  }
};
