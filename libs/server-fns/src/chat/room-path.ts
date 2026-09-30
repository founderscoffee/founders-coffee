export const CHAT_SOCKET_PREFIX = '/api/chat/';

const CHAT_ROOM_PATH = /^\/api\/chat\/([^/]+)$/u;

/**
 * The meetup a chat-room path names, or `null` for any path but `/api/chat/<eventId>`.
 *
 * The Worker's route picks a meetup's room by this id, and the room checks every session against
 * the id it reads here. Both read it with this one function, so a room only ever checks its members
 * against its own meetup, as the live room does since 1d774c91.
 */
export const chatRoomEventId = (pathname: string): string | null =>
  CHAT_ROOM_PATH.exec(pathname)?.[1] ?? null;

/** The name a meetup's chat room is addressed by, from the Worker's route and server functions. */
export const chatRoomName = (eventId: string): string => `chat:${eventId}`;
