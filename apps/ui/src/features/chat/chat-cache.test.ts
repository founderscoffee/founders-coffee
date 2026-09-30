import { describe, expect, it } from 'vitest';

import type { ChatMessageView } from './api';
import {
  chatQueryKey,
  cursorOf,
  messagesOf,
  metaOf,
  newestOf,
  withLastRead,
  withMessages,
  withMuted,
  withRemoval,
  type ChatMeta,
  type ChatPages,
} from './chat-cache';
import { chatMessage } from './chat.fixtures';

const AT = Date.UTC(2026, 8, 30, 18, 0);

const message = (
  id: string,
  minute: number,
  overrides: Partial<ChatMessageView> = {},
): ChatMessageView =>
  chatMessage(id, new Date(AT + minute * 60_000), overrides);

const meta: ChatMeta = {
  isHost: false,
  state: 'open',
  readOnlyAt: new Date(AT + 7 * 86_400_000),
  lastReadAt: new Date(AT + 60_000),
  muted: false,
};

const pagesOf = (...chunks: (readonly ChatMessageView[])[]): ChatPages => ({
  pages: chunks.map((messages, index) => ({
    messages,
    hasOlder: index < chunks.length - 1,
    meta: index === 0 ? meta : null,
  })),
  pageParams: chunks.map((_, index) => (index === 0 ? null : index)),
});

const idsOf = (pages: ChatPages | undefined) =>
  messagesOf(pages).map((held) => held.id);

describe("the chat panel's cache", () => {
  it('keys each reader apart, so one member never sees another’s pages', () => {
    expect(chatQueryKey('evt_1', 'usr_a')).not.toEqual(
      chatQueryKey('evt_1', 'usr_b'),
    );
  });

  it('reads a message’s cursor from its time and id', () => {
    expect(cursorOf(message('msg_1', 3))).toEqual({
      at: AT + 3 * 60_000,
      id: 'msg_1',
    });
  });

  it('lists every message oldest first, once, in its latest form', () => {
    const older = [message('msg_1', 1), message('msg_2', 2)];
    const newer = [
      message('msg_2', 2, { body: 'Edited by a later read' }),
      message('msg_3', 3),
    ];

    const pages = pagesOf(newer, older);

    expect(idsOf(pages)).toEqual(['msg_1', 'msg_2', 'msg_3']);
    expect(messagesOf(pages)[1]?.body).toBe('Edited by a later read');
  });

  it('orders two messages of the same millisecond by id', () => {
    const pages = pagesOf([message('msg_b', 1), message('msg_a', 1)]);

    expect(idsOf(pages)).toEqual(['msg_a', 'msg_b']);
  });

  it('reads the chat’s state from the page it opened with, and its newest message', () => {
    const pages = pagesOf([message('msg_2', 2)], [message('msg_1', 1)]);

    expect(metaOf(pages)).toBe(meta);
    expect(newestOf(pages)?.id).toBe('msg_2');
    expect(metaOf(undefined)).toBeNull();
    expect(newestOf(pagesOf([]))).toBeNull();
  });

  it('adds what arrives to the newest page, in order, and replaces what it already holds', () => {
    const pages = pagesOf(
      [message('msg_2', 2), message('msg_4', 4)],
      [message('msg_1', 1)],
    );

    const next = withMessages(pages, [
      message('msg_3', 3),
      message('msg_1', 1, { body: 'Read again' }),
    ]);

    expect(next?.pages[0]?.messages.map((held) => held.id)).toEqual([
      'msg_2',
      'msg_3',
      'msg_4',
    ]);
    expect(next?.pages[1]?.messages[0]?.body).toBe('Read again');
    expect(next?.pages[0]?.meta).toBe(meta);
  });

  it('leaves the pages as they are when nothing arrives, and holds nothing before the first read', () => {
    const pages = pagesOf([message('msg_1', 1)]);

    expect(withMessages(pages, [])).toBe(pages);
    expect(withMessages(undefined, [message('msg_1', 1)])).toBeUndefined();
  });

  it('turns a removed message into its tombstone, with who removed it', () => {
    const pages = pagesOf([message('msg_1', 1), message('msg_2', 2)]);

    const next = withRemoval(pages, { id: 'msg_1', removal: 'host' });

    expect(messagesOf(next)[0]).toMatchObject({
      id: 'msg_1',
      body: '',
      removal: 'host',
    });
    expect(messagesOf(next)[1]?.body).toBe('Body of msg_2');
  });

  it('moves the read marker forward and never back', () => {
    const pages = pagesOf([message('msg_1', 1)]);
    const later = new Date(AT + 5 * 60_000);

    const moved = withLastRead(pages, later);

    expect(metaOf(moved)?.lastReadAt).toEqual(later);
    expect(withLastRead(moved, new Date(AT))).toBe(moved);
    expect(withLastRead(undefined, later)).toBeUndefined();
  });

  it('keeps the reader’s choice to mute the chat with the page it opened with', () => {
    const pages = pagesOf([message('msg_2', 2)], [message('msg_1', 1)]);

    const muted = withMuted(pages, true);

    expect(metaOf(muted)?.muted).toBe(true);
    expect(metaOf(withMuted(muted, false))?.muted).toBe(false);
    expect(messagesOf(muted)).toEqual(messagesOf(pages));
    expect(withMuted(undefined, true)).toBeUndefined();
  });
});
