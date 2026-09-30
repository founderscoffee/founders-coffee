import type { InfiniteData } from '@tanstack/react-query';

import type { ChatCursor, ChatMessageView, ChatPage } from './api';

export type ChatMeta = Omit<ChatPage, 'messages' | 'hasOlder'>;

export type ChatChunk = {
  readonly messages: readonly ChatMessageView[];
  readonly hasOlder: boolean;
  readonly meta: ChatMeta | null;
};

export type ChatPages = InfiniteData<ChatChunk>;

export type ChatRemoval = Pick<ChatMessageView, 'id'> & {
  readonly removal: NonNullable<ChatMessageView['removal']>;
};

export const chatQueryKey = (eventId: string, viewerId: string | null) =>
  ['chat', eventId, viewerId] as const;

/** Where a page of history before or after `message` starts, as the server functions read it. */
export const cursorOf = (message: ChatMessageView): ChatCursor => ({
  at: message.createdAt.getTime(),
  id: message.id,
});

const byTimeline = (a: ChatMessageView, b: ChatMessageView): number =>
  a.createdAt.getTime() - b.createdAt.getTime() ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Every message the pages hold, oldest first and each once.
 *
 * A message can reach the cache twice, from a page read and from the room's push, and a reconnect
 * fetches from the newest one held, so the same id is kept once, in its latest form.
 */
export const messagesOf = (pages: ChatPages | undefined): ChatMessageView[] => {
  const byId = new Map<string, ChatMessageView>();
  for (const chunk of [...(pages?.pages ?? [])].reverse())
    for (const message of chunk.messages) byId.set(message.id, message);
  return [...byId.values()].sort(byTimeline);
};

/** The chat's state and the reader's own, from the page the panel opened with. */
export const metaOf = (pages: ChatPages | undefined): ChatMeta | null =>
  pages?.pages[0]?.meta ?? null;

/** The newest message the pages hold, which the gap after a reconnect is read from. */
export const newestOf = (
  pages: ChatPages | undefined,
): ChatMessageView | null => messagesOf(pages).at(-1) ?? null;

const replaceIn = (
  pages: ChatPages,
  change: (message: ChatMessageView) => ChatMessageView,
): ChatPages => ({
  ...pages,
  pages: pages.pages.map((chunk) => ({
    ...chunk,
    messages: chunk.messages.map(change),
  })),
});

/**
 * The pages with `arrived` in them: a message they already hold is replaced where it is, and a new
 * one joins the newest page.
 */
export const withMessages = (
  pages: ChatPages | undefined,
  arrived: readonly ChatMessageView[],
): ChatPages | undefined => {
  if (!pages || arrived.length === 0) return pages;
  const fresh = new Map(arrived.map((message) => [message.id, message]));
  const held = new Set(messagesOf(pages).map((message) => message.id));
  const replaced = replaceIn(
    pages,
    (message) => fresh.get(message.id) ?? message,
  );
  const added = arrived.filter((message) => !held.has(message.id));
  if (added.length === 0) return replaced;
  const [newest, ...older] = replaced.pages;
  if (!newest) return replaced;
  return {
    ...replaced,
    pages: [
      { ...newest, messages: [...newest.messages, ...added].sort(byTimeline) },
      ...older,
    ],
  };
};

/** The pages with the reader's read marker moved forward to `at`, and never back. */
export const withLastRead = (
  pages: ChatPages | undefined,
  at: Date,
): ChatPages | undefined => {
  const [first, ...rest] = pages?.pages ?? [];
  if (!pages || !first?.meta) return pages;
  const marker = first.meta.lastReadAt;
  if (marker && marker.getTime() >= at.getTime()) return pages;
  return {
    ...pages,
    pages: [{ ...first, meta: { ...first.meta, lastReadAt: at } }, ...rest],
  };
};

/** The pages with a removed message emptied and marked with who removed it, as its tombstone. */
export const withRemoval = (
  pages: ChatPages | undefined,
  removed: ChatRemoval,
): ChatPages | undefined =>
  pages &&
  replaceIn(pages, (message) =>
    message.id === removed.id
      ? { ...message, body: '', removal: removed.removal }
      : message,
  );
