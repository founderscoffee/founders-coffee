export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 3;
export const HEARTBEAT_FRAME = '{"type":"heartbeat"}';
export const HEARTBEAT_ACK_FRAME = '{"type":"heartbeat_ack"}';
