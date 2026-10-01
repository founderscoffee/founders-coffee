import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer } from './ChatComposer';

const onSend = vi.fn();

const show = (isSending = false) =>
  render(<ChatComposer locale="en" isSending={isSending} onSend={onSend} />);

const field = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement;

const sendButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  onSend.mockReset();
});

describe('ChatComposer', () => {
  it('writes in the direction of what is typed, with the keyboard’s send key', () => {
    show();

    expect(field().getAttribute('dir')).toBe('auto');
    expect(field().getAttribute('enterkeyhint')).toBe('send');
    expect(field().maxLength).toBe(1000);
    expect(field().placeholder).toBe('Write a message');
  });

  it('offers to send only something that would be sent', () => {
    show();
    expect(sendButton().disabled).toBe(true);

    fireEvent.change(field(), { target: { value: '   ' } });
    expect(sendButton().disabled).toBe(true);

    fireEvent.change(field(), { target: { value: 'Salam' } });
    expect(sendButton().disabled).toBe(false);
  });

  it('clears the draft once the message is accepted, and keeps it when it is not', () => {
    show();
    fireEvent.change(field(), { target: { value: 'Salam' } });

    onSend.mockReturnValueOnce(false);
    fireEvent.click(sendButton());
    expect(onSend).toHaveBeenCalledWith('Salam');
    expect(field().value).toBe('Salam');

    onSend.mockReturnValueOnce(true);
    fireEvent.click(sendButton());
    expect(field().value).toBe('');
  });

  it('waits while the previous message is sending, keeping the keyboard open', () => {
    show(true);
    fireEvent.change(field(), { target: { value: 'Salam' } });

    expect(sendButton().disabled).toBe(true);
    const press = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    sendButton().dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
  });
});
