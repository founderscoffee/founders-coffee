import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatDialog } from './ChatDialog';

const onClose = vi.fn();

const show = () =>
  render(
    <ChatDialog locale="en" title="Founders breakfast" onClose={onClose}>
      <p>Conversation</p>
    </ChatDialog>,
  );

const dialog = (): HTMLDialogElement =>
  screen.getByRole('dialog', {
    name: 'Chat Founders breakfast',
  }) as HTMLDialogElement;

afterEach(() => {
  cleanup();
  onClose.mockClear();
});

describe('ChatDialog', () => {
  it('opens as a modal named by the meetup it belongs to', () => {
    show();

    expect(dialog().open).toBe(true);
    expect(screen.getByText('Conversation')).toBeTruthy();
  });

  it('closes once from its close button', () => {
    show();
    const panel = dialog();

    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));

    expect(panel.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes once on Escape', () => {
    show();
    const panel = dialog();

    fireEvent.keyDown(panel, { key: 'Escape' });

    expect(panel.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes once when the browser closes it, from the backdrop or a back gesture', () => {
    show();

    dialog().close();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for a close event that arrives after it opened again', () => {
    show();

    fireEvent(dialog(), new Event('close'));

    expect(dialog().open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks nothing of the page when it is taken away', () => {
    const { unmount } = show();

    unmount();

    expect(onClose).not.toHaveBeenCalled();
  });
});
