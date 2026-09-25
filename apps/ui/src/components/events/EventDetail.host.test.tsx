import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';

import { event, market } from './EventDetail.fixtures';

const { EventDetail } = await import('./EventDetail');

afterEach(() => cleanup());

type Host = Parameters<typeof EventDetail>[0]['host'];

const yacine = { userId: 'usr_1', displayName: 'Yacine' } as Host;

const CARD_LABEL = {
  ar: 'المضيف',
  en: 'Host',
  fr: 'Organisateur',
} satisfies Record<Locale, string>;

const CITY = {
  ar: 'الجزائر',
  en: 'Algiers',
  fr: 'Alger',
} satisfies Record<Locale, string>;

const renderPage = (locale: Locale, host: Host) =>
  render(
    <EventDetail
      locale={locale}
      market={market}
      event={event}
      host={host}
      isHost={false}
      live={null}
      isWindowOpen={false}
    />,
  );

const hostCard = (locale: Locale): HTMLElement => {
  const card = screen
    .getByRole('heading', { name: CARD_LABEL[locale] })
    .closest('section');
  if (!card) throw new Error('the host card lost its section');
  return card;
};

const timesSaid = (element: HTMLElement, word: string) =>
  (element.textContent ?? '').split(word).length - 1;

describe('what the host card says', () => {
  it.each<Locale>(['ar', 'en', 'fr'])(
    'puts the city alone under the host’s name, in %s',
    (locale) => {
      renderPage(locale, yacine);

      expect(
        within(hostCard(locale)).getByText(CITY[locale]),
        'the line under the name started with the role the card is already labelled with: Host, then Host · Algiers',
      ).toBeTruthy();
    },
  );

  it.each([
    ['en', 'Host'],
    ['ar', 'مضيف'],
  ] as const)('names the role once in %s, above the name', (locale, role) => {
    renderPage(locale, yacine);

    expect(timesSaid(hostCard(locale), role)).toBe(1);
    expect(within(hostCard(locale)).getByText('Yacine')).toBeTruthy();
  });

  it.each([
    ['en', 'Host'],
    ['ar', 'مضيف'],
  ] as const)(
    'stands in no name for a host without a public profile, in %s',
    (locale, role) => {
      renderPage(locale, null);

      expect(
        timesSaid(hostCard(locale), role),
        'with no profile the card read Host, then Host where the name goes, then Host · Algiers',
      ).toBe(1);
      expect(within(hostCard(locale)).getByText(CITY[locale])).toBeTruthy();
    },
  );

  it('keeps the initials out of what a screen reader reads', () => {
    renderPage('en', null);

    expect(
      within(hostCard('en')).getByText('?').getAttribute('aria-hidden'),
      'the initials repeat the name beside them, and with no name they are a question mark',
    ).toBe('true');
  });
});

describe('where the host card sends a reader', () => {
  it.each<Locale>(['ar', 'en', 'fr'])(
    'names the profile in the language the page is in, in %s',
    (locale) => {
      const view = renderPage(locale, yacine);
      const link = view.container.querySelector('a[href*="/u/"]');

      expect(
        link?.getAttribute('href'),
        'the profile is reached from a page written in one language, and it opens in whatever the reader last stored unless the address says otherwise',
      ).toBe(`/${locale}/u/usr_1`);
    },
  );
});
