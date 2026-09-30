import { describe, expect, it } from 'vitest';

import type { ChatMessageView } from './api';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatListItems,
  sendableBody,
  type ChatListItem,
  type PendingMessage,
} from './chat-items';
import { chatMessage, YACINE } from './chat.fixtures';

const ALGIERS = 'Africa/Algiers';
const NOW = new Date('2026-09-30T20:00:00Z');

const message = (
  id: string,
  at: string,
  overrides: Partial<ChatMessageView> = {},
): ChatMessageView => chatMessage(id, new Date(at), overrides);

const itemsOf = (
  messages: readonly ChatMessageView[],
  options: {
    readonly lastReadAt?: Date | null;
    readonly pending?: readonly PendingMessage[];
  } = {},
): ChatListItem[] =>
  chatListItems({
    messages,
    pending: options.pending ?? [],
    lastReadAt: options.lastReadAt ?? null,
    now: NOW,
    timeZone: ALGIERS,
  });

const shapeOf = (items: readonly ChatListItem[]) =>
  items.map((item) => {
    if (item.kind === 'day') return `day:${item.day}`;
    if (item.kind === 'message')
      return `${item.message.id}${item.isFirstOfRun ? '*' : ''}`;
    if (item.kind === 'pending') return `pending:${item.pending.clientId}`;
    return item.kind;
  });

describe('the rows of a chat’s log', () => {
  it('starts each day of the market’s calendar with a line, today and yesterday by name', () => {
    const items = itemsOf([
      message('msg_1', '2026-09-28T22:30:00Z'),
      message('msg_2', '2026-09-28T23:30:00Z'),
      message('msg_3', '2026-09-30T10:00:00Z'),
    ]);

    expect(shapeOf(items)).toEqual([
      'day:earlier',
      'msg_1*',
      'day:yesterday',
      'msg_2*',
      'day:today',
      'msg_3*',
    ]);
  });

  it('shows a face and a name once per run of one member’s messages', () => {
    const items = itemsOf([
      message('msg_1', '2026-09-30T10:00:00Z'),
      message('msg_2', '2026-09-30T10:04:00Z'),
      message('msg_3', '2026-09-30T10:10:00Z'),
      message('msg_4', '2026-09-30T10:11:00Z', { author: YACINE }),
      message('msg_5', '2026-09-30T10:12:00Z'),
    ]);

    expect(shapeOf(items)).toEqual([
      'day:today',
      'msg_1*',
      'msg_2',
      'msg_3*',
      'msg_4*',
      'msg_5*',
    ]);
  });

  it('ends a run at a system message or a removed one', () => {
    const items = itemsOf([
      message('msg_1', '2026-09-30T10:00:00Z', { removal: 'author', body: '' }),
      message('msg_2', '2026-09-30T10:01:00Z'),
      message('msg_3', '2026-09-30T10:02:00Z', {
        kind: 'system',
        author: null,
        body: '',
        systemKey: 'rescheduled',
      }),
      message('msg_4', '2026-09-30T10:03:00Z'),
    ]);

    expect(shapeOf(items)).toEqual([
      'day:today',
      'msg_1*',
      'msg_2*',
      'msg_3*',
      'msg_4*',
    ]);
  });

  it('puts the unread divider before the first message since the marker that someone else left standing', () => {
    const items = itemsOf(
      [
        message('msg_1', '2026-09-30T10:00:00Z'),
        message('msg_2', '2026-09-30T10:05:00Z', {
          isOwn: true,
          author: YACINE,
        }),
        message('msg_3', '2026-09-30T10:06:00Z', {
          removal: 'host',
          body: '',
        }),
        message('msg_4', '2026-09-30T10:07:00Z', {
          kind: 'system',
          author: null,
          body: '',
        }),
      ],
      { lastReadAt: new Date('2026-09-30T10:01:00Z') },
    );

    expect(shapeOf(items)).toEqual([
      'day:today',
      'msg_1*',
      'msg_2*',
      'msg_3*',
      'unread',
      'msg_4*',
    ]);
  });

  it('draws no divider for a reader who has never opened the chat, or who has read it all', () => {
    const messages = [message('msg_1', '2026-09-30T10:00:00Z')];

    expect(shapeOf(itemsOf(messages))).not.toContain('unread');
    expect(
      shapeOf(
        itemsOf(messages, { lastReadAt: new Date('2026-09-30T11:00:00Z') }),
      ),
    ).not.toContain('unread');
  });

  it('lists what is still sending after what is stored, on its own day', () => {
    const items = itemsOf([message('msg_1', '2026-09-29T10:00:00Z')], {
      pending: [
        {
          clientId: 'client-1',
          body: 'See https://example.com.',
          createdAt: NOW,
          status: 'sending',
        },
      ],
    });

    expect(shapeOf(items)).toEqual([
      'day:yesterday',
      'msg_1*',
      'day:today',
      'pending:client-1',
    ]);
    const pending = items.at(-1);
    expect(pending?.kind === 'pending' && pending.segments).toEqual([
      { kind: 'text', text: 'See ' },
      {
        kind: 'link',
        text: 'https://example.com',
        href: 'https://example.com/',
      },
      { kind: 'text', text: '.' },
    ]);
  });
});

describe('what the composer sends', () => {
  it('sends a message as the chat keeps it, one line with nothing invisible', () => {
    expect(sendableBody('  Salam\nà tous​ ')).toBe('Salam à tous');
  });

  it('sends nothing blank, and nothing longer than a message may be', () => {
    expect(sendableBody(' \n\t ')).toBeNull();
    expect(sendableBody('​')).toBeNull();
    expect(sendableBody('a'.repeat(CHAT_MESSAGE_MAX_LENGTH))).toHaveLength(
      CHAT_MESSAGE_MAX_LENGTH,
    );
    expect(sendableBody('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1))).toBeNull();
  });
});
