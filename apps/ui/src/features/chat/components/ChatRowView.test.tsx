import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessageView } from '../api';
import type { ChatRow } from '../chat-rows';
import { chatMessage } from '../chat.fixtures';
import { ChatRowView } from './ChatRowView';

const AT = new Date('2026-09-30T18:05:00Z');

const messageRow = (message: ChatMessageView): ChatRow => ({
  kind: 'message',
  key: message.id,
  message,
  segments: message.body ? [{ kind: 'text', text: message.body }] : [],
  notice:
    message.kind === 'system'
      ? { key: 'cancelled', params: { reason: 'Venue closed.' } }
      : null,
  isFirstOfRun: true,
});

const onMessageActions = vi.fn();

const show = (row: ChatRow, isHost = false) =>
  render(
    <ChatRowView
      locale="en"
      timeZone="Africa/Algiers"
      row={row}
      history={{
        hasMore: false,
        isLoading: false,
        hasFailed: false,
        load: vi.fn(),
      }}
      canRetry
      isHost={isHost}
      onRetry={vi.fn()}
      onMessageActions={onMessageActions}
    />,
  ).container;

afterEach(() => {
  cleanup();
  onMessageActions.mockReset();
});

describe('ChatRowView', () => {
  it('shows a change to the meetup as a line of its own, not as anyone’s message', () => {
    const container = show(
      messageRow(
        chatMessage('msg_1', AT, {
          kind: 'system',
          author: null,
          body: '',
          systemKey: 'cancelled',
          systemParams: { reason: 'Venue closed.' },
        }),
      ),
    );

    expect(
      screen.getByText(
        'The host cancelled the meetup. There is no need to go.',
      ),
    ).toBeTruthy();
    expect(container.querySelector('.chat')).toBeNull();
  });

  it('shows a member’s message as their message', () => {
    const container = show(messageRow(chatMessage('msg_1', AT)));

    expect(container.querySelector('.chat-start .chat-bubble')).not.toBeNull();
    expect(screen.getByText('Body of msg_1')).toBeTruthy();
  });

  it('opens the actions of the message whose options were chosen', () => {
    const message = chatMessage('msg_1', AT);
    show(messageRow(message));

    fireEvent.click(
      screen.getByRole('button', { name: 'Options for Amina’s message' }),
    );

    expect(onMessageActions).toHaveBeenCalledExactlyOnceWith(message);
  });

  it('offers no options on a message already removed, even to the host', () => {
    show(
      messageRow(chatMessage('msg_1', AT, { body: '', removal: 'author' })),
      true,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
