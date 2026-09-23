import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PushPermissionPrompt } from '../features/events/components/PushPermissionPrompt';
import { CancelEventDialog } from './events/CancelEventDialog';
import { RsvpCancelDialog } from './events/RsvpCancelDialog';
import { ShareDialog } from './events/ShareDialog';

const nameOf = (element: HTMLElement): string =>
  element.getAttribute('aria-label') ?? (element.textContent ?? '').trim();

const reachable = (element: HTMLElement): boolean =>
  element.tabIndex >= 0 && element.closest('[aria-hidden="true"]') === null;

const tabStopNames = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('dialog a[href], dialog button')]
    .filter(reachable)
    .map(nameOf);

const backdrop = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.modal-backdrop button');

const DIALOGS = [
  [
    'the host cancelling their own meetup',
    (onDismiss: () => void) =>
      render(
        <CancelEventDialog
          isOpen={true}
          locale="ar"
          reason=""
          isPending={false}
          onReasonChange={vi.fn()}
          onKeep={onDismiss}
          onConfirm={vi.fn()}
        />,
      ),
  ],
  [
    'an attendee giving up their seat',
    (onDismiss: () => void) =>
      render(
        <RsvpCancelDialog
          isOpen={true}
          hostName="أمينة"
          locale="ar"
          isPending={false}
          onKeep={onDismiss}
          onConfirm={vi.fn()}
        />,
      ),
  ],
  [
    'sharing a meetup',
    (onDismiss: () => void) =>
      render(
        <ShareDialog
          isOpen={true}
          locale="ar"
          title="لقاء قهوة"
          text="انضم إلينا"
          url="https://founders.coffee/ar/algeria/e/coffee"
          onClose={onDismiss}
        />,
      ),
  ],
  [
    'asking to send reminders',
    (onDismiss: () => void) =>
      render(
        <PushPermissionPrompt
          locale="ar"
          onAccept={vi.fn()}
          onDecline={onDismiss}
        />,
      ),
  ],
] as const;

beforeEach(() => {
  vi.stubGlobal('Notification', { permission: 'default' });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(DIALOGS)('the tab order of the dialog for %s', (_what, show) => {
  it('leaves the backdrop out of it', () => {
    show(vi.fn());

    expect(backdrop(), 'this dialog has a backdrop to speak of').not.toBeNull();
    expect(
      backdrop()?.tabIndex,
      'the backdrop is a button the width and height of the viewport, and every dialog here already offers a real way out, so a tab stop on it is a stop on nothing a reader can see',
    ).toBe(-1);
  });

  it('gives every button and link a name of its own', () => {
    show(vi.fn());
    const names = tabStopNames();

    expect(
      names.length,
      'the dialog offers somewhere to tab at all',
    ).toBeGreaterThan(0);
    expect(
      names.filter((name) => name === ''),
      'every one of them says what it does',
    ).toEqual([]);
    expect(
      [...names].sort(),
      'a reader tabbing through heard the same name twice and had no way to tell which one did what',
    ).toEqual([...new Set(names)].sort());
  });

  it('still lets the reader click past it to leave', () => {
    show(vi.fn());
    const form = backdrop()?.closest('form');

    expect(
      [form?.getAttribute('method'), backdrop()?.getAttribute('type')],
      'a submit button inside a dialog-method form is how clicking outside closes this dialog; jsdom does not run that submission, so the mechanism is what can be checked here and the behaviour was walked in a browser',
    ).toEqual(['dialog', 'submit']);
  });

  it('opens in the top layer, which is what holds tab inside it', () => {
    show(vi.fn());

    expect(
      document.querySelector('dialog')?.open,
      'nothing in the markup opens this dialog any more, so it is open here only because showModal was called; an open attribute would render it in the page instead, where tab walks straight out into whatever is behind and Escape does nothing',
    ).toBe(true);
  });
});
