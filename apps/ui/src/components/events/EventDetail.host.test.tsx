import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

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
      phase="upcoming"
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

const HOSTING = {
  ar: 'أنت المضيف',
  en: "You're hosting",
  fr: 'Vous organisez',
} satisfies Record<Locale, string>;

const calledOff = {
  ...event,
  status: 'cancelled',
  cancelledAt: new Date('2026-09-10T00:00:00Z'),
} satisfies EventDetailItem;

const renderAsHost = (
  locale: Locale,
  item: EventDetailItem = event,
  isChatOn = false,
) =>
  render(
    <EventDetail
      locale={locale}
      market={{
        ...market,
        featureFlags: { ...market.featureFlags, meetupChat: isChatOn },
      }}
      event={item}
      host={yacine}
      isHost
      live={null}
      isWindowOpen={false}
      phase="upcoming"
    />,
  );

describe('how the host card tells the host it is theirs', () => {
  it.each<Locale>(['ar', 'en', 'fr'])(
    'carries the badge that says so, in %s',
    (locale) => {
      renderAsHost(locale);

      expect(
        within(hostCard(locale)).getByText(HOSTING[locale]),
        'the badge sat in the panel beside the details, away from the card that names the host',
      ).toBeTruthy();
    },
  );

  it('shows no badge to anyone else', () => {
    renderPage('en', yacine);

    expect(screen.queryByText(HOSTING.en)).toBeNull();
  });
});

describe("where the host's panel sits beside the details", () => {
  it('starts both columns below the heading, so their tops meet', () => {
    const view = renderAsHost('en');
    const heading = screen.getByRole('heading', { name: 'Meetup details' });
    const details = screen.getByRole('region', { name: 'Meetup details' });
    const panel = view.container.querySelector('aside');

    expect(
      details.contains(heading),
      'with the heading inside the details column, a guessed 48px pushed the panel down and it sat 6px below the boxes',
    ).toBe(false);
    expect(panel?.parentElement).toBe(details.parentElement);
  });

  it("grows the host card to the panel's height for the host alone", () => {
    renderAsHost('en');
    expect(
      hostCard('en').className.split(' '),
      'a host whose panel runs taller than the details still sees both columns end level',
    ).toContain('flex-1');

    cleanup();
    renderPage('en', yacine);
    expect(
      hostCard('en').className.split(' '),
      "beside a member's taller box, the card grew 140px of nothing",
    ).not.toContain('flex-1');
  });

  it('leaves the panel out for a meetup called off with no chat to open', () => {
    renderAsHost('en', calledOff);

    expect(
      screen.queryByRole('heading', { name: 'Your meetup' }),
      'once the badge moved to the host card, the panel held nothing but its title',
    ).toBeNull();
  });

  it('keeps it for a meetup called off whose chat is still open', () => {
    renderAsHost('en', calledOff, true);

    expect(screen.getByRole('heading', { name: 'Your meetup' })).toBeTruthy();
  });
});
