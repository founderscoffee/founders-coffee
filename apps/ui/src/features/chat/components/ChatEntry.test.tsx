import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatEntry } from './ChatEntry';

const mocks = vi.hoisted(() => ({ open: vi.fn(), preload: vi.fn() }));

vi.mock('../useChatAddress', () => ({
  useChatAddress: () => ({ isOpen: false, open: mocks.open, close: vi.fn() }),
}));
vi.mock('../chat-panel-loader', () => ({
  preloadChatConversation: mocks.preload,
}));

const entry = () => screen.getByRole('button', { name: 'Open chat' });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatEntry', () => {
  it('names the chat and who can read it', () => {
    render(<ChatEntry locale="en" />);

    expect(screen.getByRole('region', { name: 'Chat' })).toBeTruthy();
    expect(
      screen.getByText(
        'Only the host and the people going can read this chat.',
      ),
    ).toBeTruthy();
    expect(entry().getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens the panel from its button', () => {
    render(<ChatEntry locale="en" />);

    fireEvent.click(entry());

    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it('starts loading the panel as soon as the reader heads for the button', () => {
    render(<ChatEntry locale="en" />);

    fireEvent.focus(entry());
    fireEvent.pointerEnter(entry());
    fireEvent.touchStart(entry());

    expect(mocks.preload).toHaveBeenCalledTimes(3);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
