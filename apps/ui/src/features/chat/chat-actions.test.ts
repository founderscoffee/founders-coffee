import { describe, expect, it } from 'vitest';

import { chatMessageActions } from './chat-actions';
import { chatMessage } from './chat.fixtures';

const AT = new Date('2026-09-30T18:05:00Z');

describe('what the reader may do with a message', () => {
  it.each([
    [false, ['delete']],
    [true, ['delete']],
  ] as const)(
    'offers their own message only to delete, whether or not they host (host: %s)',
    (isHost, actions) => {
      expect(
        chatMessageActions(chatMessage('msg_1', AT, { isOwn: true }), isHost),
      ).toEqual(actions);
    },
  );

  it('offers someone else’s message to report, and to the host to remove as well', () => {
    const message = chatMessage('msg_1', AT);

    expect(chatMessageActions(message, false)).toEqual(['report']);
    expect(chatMessageActions(message, true)).toEqual(['remove', 'report']);
  });

  it.each([
    [
      'a notice about the meetup',
      chatMessage('msg_1', AT, {
        kind: 'system',
        author: null,
        body: '',
        systemKey: 'cancelled',
        systemParams: {},
      }),
    ],
    [
      'a message already removed',
      chatMessage('msg_1', AT, { body: '', removal: 'host' }),
    ],
    [
      'the reader’s own message already deleted',
      chatMessage('msg_1', AT, { body: '', removal: 'author', isOwn: true }),
    ],
  ])('offers nothing for %s', (_, message) => {
    expect(chatMessageActions(message, true)).toEqual([]);
  });
});
