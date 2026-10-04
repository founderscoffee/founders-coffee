import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatEntry } from './ChatEntry';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  preload: vi.fn(),
  isOpen: false,
  counts: new Map<string, number>(),
  countsAsked: vi.fn(),
}));

vi.mock('../useChatAddress', () => ({
  useChatAddress: () => ({
    isOpen: mocks.isOpen,
    open: mocks.open,
    close: vi.fn(),
  }),
}));
vi.mock('../chat-panel-loader', () => ({
  preloadChatConversation: mocks.preload,
}));
vi.mock('../hooks', () => ({
  useChatUnreadCounts: (eventIds: readonly string[], isEnabled: boolean) => {
    mocks.countsAsked(eventIds, isEnabled);
    return mocks.counts;
  },
}));

const entry = () => screen.getByRole('button', { name: /^Open chat/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isOpen = false;
  mocks.counts = new Map();
});

describe('ChatEntry', () => {
  it('names the chat and who can read it', () => {
    render(<ChatEntry locale="en" eventId="evt_1" />);

    expect(screen.getByRole('region', { name: 'Chat' })).toBeTruthy();
    expect(
      screen.getByText(
        'Only the host and the people going can read this chat.',
      ),
    ).toBeTruthy();
    expect(entry().getAttribute('aria-haspopup')).toBe('dialog');
  });
});
