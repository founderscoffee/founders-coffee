import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { chat } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';

import type { ChatMessageView } from '../api';
import type { PendingMessage } from '../chat-items';
import { chatMessage } from '../chat.fixtures';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatPendingItem } from './ChatPendingItem';

const AT = new Date('2026-09-30T18:05:00Z');

const textOf = (body: string): chat.ChatBodySegment[] =>
  body ? [{ kind: 'text', text: body }] : [];

const show = (
  message: ChatMessageView,
  isFirstOfRun = true,
  segments = textOf(message.body),
) =>
  render(
    <ChatMessageItem
      locale="en"
      timeZone="Africa/Algiers"
      message={message}
      segments={segments}
      isFirstOfRun={isFirstOfRun}
    />,
  );

afterEach(cleanup);

describe('ChatMessageItem', () => {
  it('shows another member’s message on the start side, with their name and the market’s time', () => {
    const { container } = show(
      chatMessage('msg_1', AT, { body: 'Salam, see https://example.com' }),
      true,
      [
        { kind: 'text', text: 'Salam, see ' },
        {
          kind: 'link',
          text: 'https://example.com',
          href: 'https://example.com/',
        },
      ],
    );

    expect(container.querySelector('.chat-start')).not.toBeNull();
    expect(screen.getByText('Amina')).toBeTruthy();
    const time = screen.getByText('19:05');
    expect(time.getAttribute('dir')).toBe('ltr');
    expect(time.getAttribute('datetime')).toBe(AT.toISOString());
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link.getAttribute('href')).toBe('https://example.com/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow ugc');
  });

  it('shows the reader’s own message on the end side, named for screen readers only', () => {
    const { container } = show(chatMessage('msg_1', AT, { isOwn: true }));

    expect(container.querySelector('.chat-end .chat-bubble-primary')).not.toBe(
      null,
    );
    expect(screen.getByText('You').className).toContain('sr-only');
  });

  it('keeps the name and time of a message inside a run for screen readers only', () => {
    const { container } = show(chatMessage('msg_1', AT), false);

    expect(container.querySelector('.chat-header')).toBeNull();
    expect(screen.getByText('Amina').closest('.sr-only')).not.toBeNull();
  });

  it('names a member whose account is gone as a member', () => {
    show(chatMessage('msg_1', AT, { author: null }));

    expect(screen.getByText('Member')).toBeTruthy();
  });

  it.each([
    ['author', 'Message deleted by its author'],
    ['host', 'Message removed by the host'],
    ['moderator', 'Message removed by a moderator'],
  ] as const)('says a message was removed by its %s', (removal, text) => {
    show(chatMessage('msg_1', AT, { removal, body: '' }));

    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe('ChatMessageItem’s options', () => {
  const showWithOptions = (message: ChatMessageView, locale: Locale = 'en') => {
    const onActions = vi.fn();
    render(
      <ChatMessageItem
        locale={locale}
        timeZone="Africa/Algiers"
        message={message}
        segments={textOf(message.body)}
        isFirstOfRun={false}
        onActions={onActions}
      />,
    );
    return onActions;
  };

  it('offers none unless the panel has some for the message', () => {
    show(chatMessage('msg_1', AT));

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names whose message the options are for, and opens them', () => {
    const onActions = showWithOptions(chatMessage('msg_1', AT));

    const options = screen.getByRole('button', {
      name: 'Options for Amina’s message',
    });
    expect(options.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(options);
    expect(onActions).toHaveBeenCalledOnce();
  });

  it('calls the reader’s own message theirs, and a member with no name a member', () => {
    showWithOptions(chatMessage('msg_1', AT, { isOwn: true }));
    showWithOptions(chatMessage('msg_2', AT, { author: null }));

    expect(
      screen.getByRole('button', { name: 'Options for your message' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Options for Member’s message' }),
    ).toBeTruthy();
  });

  it('sits beside the bubble on the side facing the rest of the chat', () => {
    showWithOptions(chatMessage('msg_1', AT));
    showWithOptions(chatMessage('msg_2', AT, { isOwn: true }));

    const [theirs, own] = screen.getAllByRole('button');
    expect(theirs?.parentElement?.className).toContain('start-full');
    expect(own?.parentElement?.className).toContain('end-full');
  });

  it('names them in the reader’s language', () => {
    showWithOptions(chatMessage('msg_1', AT), 'ar');
    showWithOptions(chatMessage('msg_2', AT), 'fr');

    expect(
      screen.getByRole('button', { name: 'خيارات رسالة Amina' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Options du message de Amina' }),
    ).toBeTruthy();
  });
});

describe('ChatPendingItem', () => {
  const pending = (status: PendingMessage['status']): PendingMessage => ({
    clientId: 'client-1',
    body: 'Salam',
    createdAt: AT,
    status,
  });

  const showPending = (status: PendingMessage['status'], canRetry = true) => {
    const onRetry = vi.fn();
    render(
      <ChatPendingItem
        locale="en"
        pending={pending(status)}
        segments={textOf('Salam')}
        canRetry={canRetry}
        onRetry={onRetry}
      />,
    );
    return onRetry;
  };

  it('says a message is on its way', () => {
    showPending('sending');

    expect(screen.getByText('Sending…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('offers to send a message that failed again, when the chat can take it', () => {
    const onRetry = showPending('failed');

    expect(screen.getByText('Not sent')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('client-1');
  });

  it('offers no retry while another message is sending', () => {
    showPending('failed', false);

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
