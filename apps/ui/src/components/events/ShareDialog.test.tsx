import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareDialog } from './ShareDialog';

const URL_UNDER_TEST =
  'https://founders.coffee/ar/algeria/e/founders-breakfast';
const TITLE = 'Founders breakfast';
const TEXT = 'انضم إلينا في Founders breakfast';

const show = (onClose = vi.fn()) =>
  render(
    <ShareDialog
      isOpen={true}
      locale="ar"
      title={TITLE}
      text={TEXT}
      url={URL_UNDER_TEST}
      onClose={onClose}
    />,
  );

const hrefFor = (name: RegExp | string) =>
  screen.getByRole('link', { name }).getAttribute('href') ?? '';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('ShareDialog', () => {
  it('opens as a modal dialog rather than pushing the page around', () => {
    show();
    const dialog = document.querySelector('dialog');
    expect(dialog?.classList.contains('modal')).toBe(true);
    expect(dialog?.open).toBe(true);
  });

  it('leads with WhatsApp, the channel hosts actually promote on', () => {
    show();
    const first = screen.getAllByRole('link')[0];
    expect(first?.textContent).toContain('WhatsApp');
  });

  it('sends the invitation and the link to every target', () => {
    show();

    expect(decodeURIComponent(hrefFor('WhatsApp'))).toBe(
      `https://wa.me/?text=${TEXT} ${URL_UNDER_TEST}`,
    );
    expect(decodeURIComponent(hrefFor('Telegram'))).toContain(URL_UNDER_TEST);
    expect(decodeURIComponent(hrefFor('X'))).toContain(TEXT);
    expect(decodeURIComponent(hrefFor('Facebook'))).toContain(URL_UNDER_TEST);
    expect(decodeURIComponent(hrefFor('LinkedIn'))).toContain(URL_UNDER_TEST);
    expect(decodeURIComponent(hrefFor(/البريد/))).toContain(URL_UNDER_TEST);
  });

  it('encodes each link so a space never ends the parameter early', () => {
    show();
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      expect(
        href,
        `${link.textContent} carries a raw space, which truncates the draft`,
      ).not.toMatch(/ /);
    }
  });

  it('opens every target in its own tab without leaking the referrer', () => {
    show();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noreferrer');
    }
  });

  it('shows the link itself, always copyable by hand', () => {
    show();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      URL_UNDER_TEST,
    );
  });

  it('confirms a copy on the button that did it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    show();

    const copy = screen.getByRole('button', { name: 'نسخ الرابط' });
    expect(copy.classList.contains('btn-secondary')).toBe(true);
    fireEvent.click(copy);

    const copied = await screen.findByRole('button', { name: 'نُسخ الرابط' });
    expect(
      copied.classList.contains('btn-success'),
      'the word changes but the button stays the same colour, so nothing signals the copy landed',
    ).toBe(true);
    expect(copied.classList.contains('btn-secondary')).toBe(false);
    expect(writeText).toHaveBeenCalledWith(URL_UNDER_TEST);
  });

  it('leaves the button its usual colour when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
      writable: true,
    });
    show();

    fireEvent.click(screen.getByRole('button', { name: 'نسخ الرابط' }));

    const copy = await screen.findByRole('button', { name: 'نسخ الرابط' });
    expect(
      copy.classList.contains('btn-success'),
      'going green on a refused copy tells the reader they have a link they do not',
    ).toBe(false);
  });

  it('closes on the close button in its header', () => {
    const onClose = vi.fn();
    show(onClose);
    const box = document.querySelector('.modal-box');
    expect(box).not.toBeNull();
    if (box === null) return;

    fireEvent.click(
      within(box as HTMLElement).getByRole('button', {
        name: 'إغلاق خيارات المشاركة',
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers a way out to a reader who clicks the backdrop', () => {
    show();
    const backdrop = document.querySelector('form.modal-backdrop');
    expect(
      backdrop?.getAttribute('method'),
      'without method="dialog" the backdrop submits the page instead of closing',
    ).toBe('dialog');
  });
});
