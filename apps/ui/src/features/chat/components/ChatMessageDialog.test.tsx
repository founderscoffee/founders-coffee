import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { ChatMessageView } from '../api';
import { chatMessage } from '../chat.fixtures';

type Mutation = {
  isPending: boolean;
  error: unknown;
  mutate: ReturnType<typeof vi.fn>;
};

const idle = (): Mutation => ({
  isPending: false,
  error: null,
  mutate: vi.fn(),
});

const mocks = vi.hoisted(() => ({
  remove: null as unknown as Mutation,
  report: null as unknown as Mutation,
}));

vi.mock('../hooks', () => ({
  useRemoveChatMessage: () => mocks.remove,
  useReportChatMessage: () => mocks.report,
}));

const { ChatMessageDialog } = await import('./ChatMessageDialog');

const AT = new Date('2026-09-30T18:05:00Z');
const onClose = vi.fn();
const onReported = vi.fn();
const onPanelKeyDown = vi.fn();

const show = (
  message: ChatMessageView,
  options: { isHost?: boolean; locale?: Locale } = {},
) =>
  render(
    <div onKeyDown={onPanelKeyDown}>
      <ChatMessageDialog
        locale={options.locale ?? 'en'}
        eventId="evt_1"
        viewerId="usr_me"
        isHost={options.isHost ?? false}
        message={message}
        onClose={onClose}
        onReported={onReported}
      />
    </div>,
  );

const theirs = () => chatMessage('msg_1', AT, { body: 'Buy my course' });
const own = () => chatMessage('msg_2', AT, { body: 'Wrong room', isOwn: true });

mocks.remove = idle();
mocks.report = idle();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.remove = idle();
  mocks.report = idle();
});

describe('ChatMessageDialog', () => {
  it('asks before deleting the reader’s own message, then deletes it and closes', () => {
    mocks.remove.mutate.mockImplementation(
      (_: string, options: { onSuccess: () => void }) => options.onSuccess(),
    );
    show(own());

    expect(
      screen.getByRole('dialog', { name: 'Delete this message?' }),
    ).toBeTruthy();
    expect(screen.getByText('Wrong room').tagName).toBe('BDI');
    expect(
      screen.getByText(
        'It will be deleted for everyone in the chat. This cannot be undone.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mocks.remove.mutate).toHaveBeenCalledWith(
      'msg_2',
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.report.mutate).not.toHaveBeenCalled();
  });

  it('lets the host remove someone else’s message, or report it', () => {
    show(theirs(), { isHost: true });

    expect(
      screen.getByRole('dialog', { name: 'Message from Amina' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report message' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove message' }));

    expect(
      screen.getByRole('dialog', { name: 'Remove this message?' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'It will be removed for everyone in the chat, with a note that the host removed it.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(mocks.remove.mutate).toHaveBeenCalledWith(
      'msg_1',
      expect.anything(),
    );
  });

  it('asks a member why they report a message, and sends it only with a reason', () => {
    mocks.report.mutate.mockImplementation(
      (
        _: unknown,
        options: { onSuccess: (answer: { status: string }) => void },
      ) => options.onSuccess({ status: 'reported' }),
    );
    show(theirs());

    expect(
      screen.getByRole('dialog', { name: 'Report this message' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/we do not reveal who reported to the person reported/),
    ).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Report' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove message' })).toBe(null);

    fireEvent.click(screen.getByRole('radio', { name: 'Harassment or abuse' }));
    fireEvent.click(send);

    expect(mocks.report.mutate).toHaveBeenCalledWith(
      { messageId: 'msg_1', reason: 'harassment' },
      expect.anything(),
    );
    expect(onReported).toHaveBeenCalledWith('reported');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers every reason the server takes', () => {
    show(theirs());

    expect(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('value')),
    ).toEqual(['spam', 'harassment', 'other']);
    expect(screen.getByRole('group', { name: 'Reason' })).toBeTruthy();
  });

  it.each([
    [
      { code: 'chat_message_not_found' },
      'This message has already been removed.',
    ],
    [
      { code: 'rate_limited' },
      'Too many attempts. Wait a few minutes and try again.',
    ],
    [new Error('offline'), 'The message could not be deleted. Try again.'],
  ])('says why a deletion failed (%o)', (error, text) => {
    mocks.remove.error = error;
    show(own());

    expect(screen.getByRole('alert').textContent).toContain(text);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    [
      { code: 'chat_report_refused' },
      'This message can no longer be reported.',
    ],
    [new Error('offline'), 'The report could not be sent. Try again.'],
  ])('says why a report failed (%o)', (error, text) => {
    mocks.report.error = error;
    show(theirs());

    expect(screen.getByRole('alert').textContent).toContain(text);
  });

  it('holds its buttons while the change is on its way', () => {
    mocks.remove.isPending = true;
    show(own());

    for (const name of ['Cancel', 'Delete'])
      expect(
        (screen.getByRole('button', { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
  });

  it('closes on Escape without closing the chat panel behind it', () => {
    show(own());

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
    expect(onPanelKeyDown).not.toHaveBeenCalled();
  });

  it('closes when the browser closes it, from its backdrop', () => {
    show(own());

    (screen.getByRole('dialog') as HTMLDialogElement).close();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open for a close event that arrives after it opened again', () => {
    show(own());
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;

    fireEvent(dialog, new Event('close'));

    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks in the reader’s language', () => {
    show(theirs(), { locale: 'ar', isHost: true });

    expect(screen.getByRole('button', { name: 'إزالة الرسالة' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'الإبلاغ عن الرسالة' }));
    expect(
      screen.getByRole('dialog', { name: 'الإبلاغ عن هذه الرسالة' }),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'مضايقة أو إساءة' })).toBeTruthy();
  });
});
