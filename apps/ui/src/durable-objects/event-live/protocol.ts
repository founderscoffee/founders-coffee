import { z } from 'zod';

const authMessage = z.object({
  type: z.literal('auth'),
  sessionToken: z.string().min(1),
});

const arrivedMessage = z.object({
  type: z.literal('arrived'),
  tableNumber: z.number().int().positive().optional(),
  visualCue: z.string().max(200).optional(),
});

const walkingInMessage = z.object({ type: z.literal('walking_in') });

const runningLateMessage = z.object({
  type: z.literal('running_late'),
  etaMinutes: z.number().int().positive().max(120).optional(),
});

const tablePinMessage = z.object({
  type: z.literal('table_pin'),
  tableNumber: z.number().int().positive(),
});

const heartbeatMessage = z.object({ type: z.literal('heartbeat') });

export const clientMessage = z.discriminatedUnion('type', [
  authMessage,
  arrivedMessage,
  walkingInMessage,
  runningLateMessage,
  tablePinMessage,
  heartbeatMessage,
]);

export type ClientMessage = z.infer<typeof clientMessage>;

export type AttendeeStatus =
  'arrived' | 'walking_in' | 'running_late' | 'connected';

export interface RosterUser {
  userId: string;
  name: string;
  status: AttendeeStatus;
  etaMinutes?: number;
}

export interface HostState {
  userId: string;
  arrived: boolean;
  tableNumber?: number;
  visualCue?: string;
}

export interface OutboundMessage {
  type:
    | 'roster_update'
    | 'host_update'
    | 'auth_ok'
    | 'auth_required'
    | 'auth_expired'
    | 'not_attending'
    | 'heartbeat_ack'
    | 'error'
    | 'event_cancelled';
  roster?: RosterUser[];
  host?: HostState;
  message?: string;
}

export interface ConnectionInfo {
  userId: string;
  userName: string;
  isHost: boolean;
  authenticated: boolean;
  sessionToken: string;
  lastSeenAt: number;
}
