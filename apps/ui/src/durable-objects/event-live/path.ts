const LIVE_ROOM_PATH = /^\/api\/live\/([^/]+)$/u;

/**
 * The meetup a live-room path names, or `null` for any path but `/api/live/<eventId>`.
 *
 * The route picks a meetup's room by this id, and the room checks every session against the id it
 * reads here. Both read it with this one function, so a room only ever checks its members against
 * its own meetup.
 */
export const liveRoomEventId = (pathname: string): string | null =>
  LIVE_ROOM_PATH.exec(pathname)?.[1] ?? null;
