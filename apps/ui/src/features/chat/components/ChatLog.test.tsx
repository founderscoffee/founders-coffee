import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { chatListItems } from '../chat-items';
import { chatMessage } from '../chat.fixtures';
import { ChatLog } from './ChatLog';

const AT = new Date('2026-09-30T18:05:00Z');

const items = chatListItems({
  messages: [
    chatMessage('msg_1', AT),
    chatMessage('msg_2', new Date(AT.getTime() + 60_000)),
  ],
  pending: [],
  lastReadAt: AT,
  now: AT,
  timeZone: 'Africa/Algiers',
});

const show = () =>
  render(
    <ChatLog
      locale="en"
      timeZone="Africa/Algiers"
      items={items}
      history={{
        hasMore: false,
        isLoading: false,
        hasFailed: false,
        load: vi.fn(),
      }}
      isOpen
      canRetry
      isHost={false}
      onRetry={vi.fn()}
      onMessageActions={vi.fn()}
      onAtEndChange={vi.fn()}
    />,
  );

const scrollAwayFromLatest = () => {
  const scroller = screen.getByRole('log').parentElement;
  if (!scroller) throw new Error('Expected the log inside its scroller');
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    value: 2_000,
  });
  fireEvent.scroll(scroller);
};

afterEach(cleanup);

describe('ChatLog', () => {
  it('floats the jump to the latest messages over the log from a wrapper, which a touch screen leaves alone', () => {
    show();
    scrollAwayFromLatest();
    const jump = screen.getByRole('button', { name: 'Latest messages' });

    expect(jump.classList).toContain('btn');
    expect(
      jump.classList.contains('absolute'),
      'under pointer: coarse, libs/ui/src/styles.css makes every .btn relative, and that beats .absolute',
    ).toBe(false);
    expect(jump.parentElement?.classList).toContain('absolute');
    expect(jump.parentElement?.classList).toContain('bottom-3');
  });
});
