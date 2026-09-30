import { resolveSession } from '../auth.js';
import { RATE_BUDGETS } from '../rate-budgets.js';
import { consumeRateBudget } from '../rate-consume.js';
import { chatRoomOf } from './room.js';
import { CHAT_SOCKET_PREFIX, chatRoomEventId } from './room-path.js';

/**
 * Whether a browser opened this socket from a page on another site.
 *
 * A WebSocket upgrade is outside TanStack Start's CSRF middleware, as the photo upload is, and a
 * page anywhere can open one: the browser adds the member's cookies to it where the cookies allow.
 * Every browser names the page's origin in `Origin` on an upgrade, and `Sec-Fetch-Site` says how
 * it relates to this one, so a socket opened from another site is turned away on either. A request
 * without them is not a browser's, which no other site can make on a member's behalf.
 */
const isCrossSite = (request: Request, url: URL): boolean => {
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin' && site !== 'none') return true;
  const origin = request.headers.get('origin');
  return origin !== null && origin !== url.origin;
};

/** Who a connection is counted against: the signed-in member, or the address of anyone else. */
const connectIdentity = async (request: Request): Promise<string> => {
  const session = await resolveSession(request.headers);
  const userId = session?.user?.id;
  return userId
    ? `u:${userId}`
    : `ip:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`;
};

const openChatRoom = async (request: Request, url: URL): Promise<Response> => {
  const eventId = chatRoomEventId(url.pathname);
  if (!eventId) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET')
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  if (request.headers.get('Upgrade') !== 'websocket')
    return new Response('Expected WebSocket upgrade', { status: 426 });
  if (isCrossSite(request, url))
    return new Response('Forbidden', { status: 403 });

  const room = chatRoomOf(eventId);
  if (!room) return new Response('Chat unavailable', { status: 503 });
  const budget = RATE_BUDGETS.chat.connect;
  const allowed = await consumeRateBudget(
    await connectIdentity(request),
    budget.action,
    budget.limit,
    budget.windowMs,
  );
  if (!allowed) return new Response('Too many connections', { status: 429 });
  return room.fetch(request);
};

/**
 * Hand a browser's WebSocket upgrade for `/api/chat/<eventId>` to that meetup's chat room, or
 * answer it here, or `null` for a path that is not the chat's.
 *
 * Only a same-site `GET` with `Upgrade: websocket` reaches the room, as it came, and it spends a
 * connection from the member's `RATE_BUDGETS.chat` budget first. Everything else is answered at the
 * route: 404 for any other path under it, 405 for another method, 426 without the upgrade and 403
 * from another site. The room reads its meetup from the same path with the same
 * `chatRoomEventId`, and whether the reader is a member from their session cookie, so an upgrade
 * without a session is still forwarded, for the room to close with the code that tells the page to
 * sign in again.
 */
export const handleChatSocketRequest = (
  request: Request,
  url: URL,
): Promise<Response> | null =>
  url.pathname.startsWith(CHAT_SOCKET_PREFIX)
    ? openChatRoom(request, url)
    : null;
