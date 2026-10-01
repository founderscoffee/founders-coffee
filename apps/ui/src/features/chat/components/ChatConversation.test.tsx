import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessageView, ChatReportStatus } from '../api';
import { chatMessage, chatMeta } from '../chat.fixtures';
import type { EventChatView, ReadyChat } from '../useEventChat';
import { ChatConversation } from './ChatConversation';

const mocks = vi.hoisted(() => ({
  view: { status: 'loading' } as EventChatView,
  retry: vi.fn(),
  resume: vi.fn(),
  message: null as unknown as ChatMessageView,
}));

vi.mock('../useEventChat', () => ({ useEventChat: () => mocks.view }));
vi.mock('../useChatReadMarker', () => ({ useChatReadMarker: () => undefined }));
vi.mock('./ChatLog', () => ({
  ChatLog: ({
    onMessageActions,
  }: {
    onMessageActions: (message: ChatMessageView) => void;
  }) => (
    <>
      <p>chat-log</p>
      <button type="button" onClick={() => onMessageActions(mocks.message)}>
        message-options
      </button>
    </>
  ),
}));
vi.mock('./ChatMessageDialog', () => ({
  ChatMessageDialog: ({
    message,
    isHost,
    onClose,
    onReported,
  }: {
    message: ChatMessageView;
    isHost: boolean;
    onClose: () => void;
    onReported: (status: ChatReportStatus) => void;
  }) => (
    <div role="dialog" aria-label={`${message.id} as host: ${isHost}`}>
      <button type="button" onClick={() => onReported('reported')}>
        reported
      </button>
      <button type="button" onClick={() => onReported('already_reported')}>
        reported-before
      </button>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));
vi.mock('./ChatSignIn', () => ({ ChatSignIn: () => <p>chat-sign-in</p> }));

const HOUR = 60 * 60 * 1000;

const readyChat = (overrides: Partial<ReadyChat> = {}): ReadyChat => ({
  status: 'ready',
  meta: chatMeta({ readOnlyAt: new Date('2026-10-09T20:00:00Z') }),
  items: [],
  newestAt: null,
  isOpen: true,
  connection: 'live',
  resume: mocks.resume,
  history: {
    hasMore: false,
    isLoading: false,
    hasFailed: false,
    load: vi.fn(),
  },
  isSending: false,
  send: () => true,
  retrySend: vi.fn(),
  ...overrides,
});

const show = (
  view: EventChatView,
  meetup: { isCancelled?: boolean; endsAt?: Date | null } = {},
) => {
  mocks.view = view;
  return render(
    <ChatConversation
      locale="en"
      eventId="evt_1"
      viewerId="usr_me"
      isCancelled={meetup.isCancelled ?? false}
      endsAt={
        meetup.endsAt === undefined
          ? new Date(Date.now() + 2 * HOUR)
          : meetup.endsAt
      }
      timeZone="Africa/Algiers"
    />,
  );
};

const composer = () => screen.queryByRole('textbox', { name: 'Message' });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatConversation', () => {
  it('says the chat is loading', () => {
    show({ status: 'loading' });

    expect(screen.getByText('Loading the chat…')).toBeTruthy();
  });

  it('offers another try when the chat could not be loaded', () => {
    show({ status: 'error', retry: mocks.retry });

    expect(screen.getByText('The chat could not be loaded.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unavailable', 'This chat is no longer available.'],
    ['revoked', 'Only the host and the people going can read this chat.'],
  ] as const)(
    'says why a reader it turned away as %s cannot read it',
    (status, text) => {
      show({ status });

      expect(screen.getByText(text)).toBeTruthy();
      expect(screen.queryByText('chat-log')).toBeNull();
    },
  );

  it('asks a reader whose session ended to sign in again', () => {
    show({ status: 'signed_out' });

    expect(screen.getByText('chat-sign-in')).toBeTruthy();
  });

  it('lets a member write in an open chat, with no line above it before the meetup ends', () => {
    const { container } = show(readyChat());

    expect(screen.getByText('chat-log')).toBeTruthy();
    expect(composer()).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(screen.queryByText(/Open until/)).toBeNull();
  });

  it('says until when the chat stays open once the meetup has ended', () => {
    show(readyChat(), { endsAt: new Date(Date.now() - HOUR) });

    expect(screen.getByText(/Open until/).textContent).toContain('October');
    expect(composer()).toBeTruthy();
  });

  it.each([
    [false, 'This chat is read-only now.'],
    [true, 'The meetup was cancelled, so its chat is read-only.'],
  ])(
    'keeps a read-only chat to read, with nothing to write in (cancelled: %s)',
    (isCancelled, text) => {
      show(readyChat({ isOpen: false, connection: 'connecting' }), {
        isCancelled,
      });

      expect(screen.getByText(text)).toBeTruthy();
      expect(screen.getByText('chat-log')).toBeTruthy();
      expect(composer()).toBeNull();
      expect(screen.queryByText('Reconnecting…')).toBeNull();
    },
  );

  it.each([
    ['reconnecting', 'Reconnecting…'],
    [
      'offline',
      'You’re offline. New messages will show when you’re back online.',
    ],
  ] as const)('says when the chat is %s', (connection, text) => {
    show(readyChat({ connection }));

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('offers to reconnect a chat that stopped updating here', () => {
    show(readyChat({ connection: 'paused' }));

    expect(
      screen.getByText(
        'This chat is open in too many places, so it stopped updating here.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(mocks.resume).toHaveBeenCalledTimes(1);
  });

  it('opens a message’s options over the panel, telling them whether the reader hosts', () => {
    mocks.message = chatMessage('msg_1', new Date('2026-09-30T18:05:00Z'));
    show(readyChat({ meta: chatMeta({ isHost: true }) }));

    fireEvent.click(screen.getByRole('button', { name: 'message-options' }));
    expect(
      screen.getByRole('dialog', { name: 'msg_1 as host: true' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('thanks the reader for a report, and says so when they had made it before', () => {
    mocks.message = chatMessage('msg_1', new Date('2026-09-30T18:05:00Z'));
    show(readyChat());

    fireEvent.click(screen.getByRole('button', { name: 'message-options' }));
    fireEvent.click(screen.getByRole('button', { name: 'reported' }));
    expect(screen.getByRole('status').textContent).toContain(
      'Thank you. We will look at this message.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'reported-before' }));
    expect(screen.getByRole('status').textContent).toContain(
      'You have already reported this message.',
    );
  });
});
