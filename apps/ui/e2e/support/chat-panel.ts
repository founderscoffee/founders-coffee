import { expect, type Locator, type Page } from '@playwright/test';

import { LOCALE_DIRECTION, t, type E2eLocale } from './messages';

export type Screen = {
  readonly locale: E2eLocale;
  readonly width: number;
  readonly height: number;
  readonly hasTouch: boolean;
};

const SIDE_PANEL_WIDTH = 448;

export const panelOf = (page: Page, locale: E2eLocale): Locator =>
  page.getByRole('dialog', { name: new RegExp(t(locale, 'chat_title')) });

/**
 * The meetup page's chat button, matched from the start of its name: an unread count may follow
 * the word, and the panel's close button ends with it ("Close chat", « إغلاق المحادثة »).
 */
export const chatEntryOf = (page: Page, locale: E2eLocale): Locator =>
  page.getByRole('button', { name: new RegExp(`^${t(locale, 'chat_open')}`) });

export const composerOf = (panel: Locator, locale: E2eLocale): Locator =>
  panel.getByRole('textbox', { name: t(locale, 'chat_composer_label') });

/** The options of the message in `panel` that reads `text`, the one button its row holds. */
export const optionsOf = (panel: Locator, text: string): Locator =>
  panel.locator('.chat', { hasText: text }).getByRole('button');

/** Send a message and wait until the server has kept it: only a kept message shows its time. */
export const send = async (panel: Locator, locale: E2eLocale, text: string) => {
  const composer = composerOf(panel, locale);
  await composer.fill(text);
  await composer.press('Enter');
  await expect(composer).toHaveValue('');
  await expect(
    panel.locator('.chat-end', { hasText: text }).locator('time'),
  ).toBeAttached({ timeout: 15_000 });
};

/**
 * The panel fills a phone or a tablet, and from `lg` sits on the page's end side at 28rem.
 *
 * Both are measured against the dialog rather than the window. While a modal locks a page that
 * scrolls, daisyUI keeps the page's scrollbar gutter so nothing behind shifts sideways, and the
 * dialog stops short of it wherever the browser draws one; whether it has by the time of the
 * measurement depends on a scroll-driven animation, so a check against the window flickers. The
 * panel slides in, so the check is retried until it has arrived.
 */
export const expectPanelPlacement = async (
  page: Page,
  panel: Locator,
  screen: Screen,
) => {
  const isRtl = LOCALE_DIRECTION[screen.locale] === 'rtl';
  await expect(page.locator('html')).toHaveAttribute(
    'dir',
    LOCALE_DIRECTION[screen.locale],
  );
  await expect(async () => {
    const frame = await panel.boundingBox();
    const box = await panel.locator('.modal-box').boundingBox();
    const composer = await composerOf(panel, screen.locale).boundingBox();
    expect(frame).not.toBeNull();
    expect(box).not.toBeNull();
    expect(composer).not.toBeNull();
    if (!frame || !box || !composer) return;
    expect(Math.round(box.height)).toBe(screen.height);
    expect(composer.y + composer.height).toBeLessThanOrEqual(screen.height);
    const isSidePanel = screen.width >= 1024;
    expect(Math.round(box.width)).toBe(
      isSidePanel ? SIDE_PANEL_WIDTH : Math.round(frame.width),
    );
    expect(Math.round(isRtl ? box.x : box.x + box.width)).toBe(
      Math.round(isRtl ? frame.x : frame.x + frame.width),
    );
  }).toPass({ timeout: 5_000 });
};
