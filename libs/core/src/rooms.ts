export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 3;
export const HEARTBEAT_FRAME = '{"type":"heartbeat"}';
export const HEARTBEAT_ACK_FRAME = '{"type":"heartbeat_ack"}';

export const ROOM_HEARTBEAT_TIMEOUT_CLOSE = {
  code: 4002,
  reason: 'heartbeat_timeout',
} as const;

export const ROOM_TRY_AGAIN_LATER_CLOSE = {
  code: 1013,
  reason: 'try_again_later',
} as const;

export const CHAT_ROOM_CLOSES = {
  noSession: { code: 4001, reason: 'no_session' },
  revoked: { code: 4003, reason: 'revoked' },
  closed: { code: 4004, reason: 'closed' },
  superseded: { code: 4005, reason: 'superseded' },
} as const;
