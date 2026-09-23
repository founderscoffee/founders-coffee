import { cleanup, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { going_count, LOCALES, type Locale } from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => createElement('a', { href: '/', className }, children),
}));

const { EventCard } = await import('./EventCard');

const event: EventFeedItem = {
  id: 'evt_card',
  hostId: 'usr_host',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '1',
  title: 'Founder coffee',
  description: 'A short founder conversation over coffee.',
  venue: 'Coffee shop',
  slug: 'founder-coffee',
  startsAt: new Date('2026-09-18T14:00:00Z'),
  endsAt: null,
  language: 'ar',
  rsvps: 0,
  latitude: null,
  longitude: null,
  venueAddress: null,
  status: 'published',
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  cancelledAt: null,
  cancellationReason: null,
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  cityNameFr: 'Alger',
  citySlug: 'algiers',
  goingCount: 0,
  hostName: null,
  hostPhotoAssetId: null,
};

const show = (over: Partial<EventFeedItem> = {}, locale: Locale = 'en') =>
  render(
    <EventCard
      event={{ ...event, ...over }}
      locale={locale}
      timezone="Africa/Algiers"
      marketSlug="algeria"
    />,
  );

afterEach(cleanup);

describe('how many people the card says are going', () => {
  it.each<Locale>([...LOCALES])(
    'says nothing at all when nobody has said yes, in %s',
    (locale) => {
      const view = show({}, locale);

      expect(
        view.container.textContent,
        'a meetup with nobody going yet reads as unwanted; saying nothing reads as new',
      ).not.toContain(going_count({ count: 0 }, { locale }));
      expect(view.container.textContent).not.toMatch(/\+\s*0/);
    },
  );

  it('speaks up as soon as one person is going', () => {
    const view = show({ goingCount: 1, rsvps: 1 });

    expect(view.container.textContent).toContain(
      going_count({ count: 1 }, { locale: 'en' }),
    );
  });

  it('still says nothing when the count is not known', () => {
    const view = show({ goingCount: undefined });

    expect(view.container.textContent).not.toMatch(/going/);
  });

  it('leaves the host card alone, which counts differently', () => {
    const view = show({ goingCount: 3, rsvps: 3, hostName: 'Host Name' });

    expect(view.container.querySelector('.avatar-group')).toBeTruthy();
    expect(
      view.container.querySelector('.avatar-group')?.getAttribute('aria-label'),
    ).toBe(going_count({ count: 3 }, { locale: 'en' }));
    expect(
      view.container.textContent,
      'with a host shown the number is in the label of the avatars, not beside them',
    ).not.toContain(going_count({ count: 3 }, { locale: 'en' }));
  });

  it('draws the host, then a bubble for everyone else going', () => {
    const view = show({ goingCount: 3, rsvps: 3, hostName: 'Host Name' });
    const group = view.container.querySelector('.avatar-group');

    expect(
      [...(group?.children ?? [])].map((member) => member.textContent),
    ).toEqual(['H', '+2']);
  });

  it('shows the host alone when they are the only one going', () => {
    const view = show({ goingCount: 1, rsvps: 1, hostName: 'Host Name' });

    expect(view.container.querySelector('.avatar-group')).toBeNull();
    expect(view.container.textContent).toContain('Host Name');
    expect(view.container.textContent).not.toMatch(/\+\s*\d/);
  });
});

describe('what else the card fits in', () => {
  it('keeps the description to one line', () => {
    const view = show({
      description:
        'A long founder conversation about pricing, first customers and everything in between.',
    });
    const description = view.getByText(/A long founder conversation/);

    expect(
      description.className
        .split(' ')
        .filter((name) => name.startsWith('line-clamp-')),
    ).toEqual(['line-clamp-1']);
  });

  it.each<Locale>(['fr', 'en'])(
    'reads the host line the way the page reads, in %s',
    (locale) => {
      const view = show(
        { goingCount: 3, rsvps: 3, hostName: 'Host Name' },
        locale,
      );

      expect(
        view.container.querySelector('footer [dir="rtl"]'),
        'forcing right to left puts the name before the face on a left-to-right page',
      ).toBeNull();
    },
  );
});

describe('what the card calls the city', () => {
  const cairo = {
    cityName: 'Cairo',
    cityNameAr: 'القاهرة',
    cityNameFr: 'Le Caire',
    citySlug: 'cairo',
  };

  it.each([
    ['ar', '، القاهرة'],
    ['en', ', Cairo'],
    ['fr', ', Le Caire'],
  ] as const)('names it the way a reader in %s knows it', (locale, place) => {
    const view = show(cairo, locale);

    expect(
      view.container.textContent,
      'a French card said Cairo, the English name, where every French page says Le Caire',
    ).toContain(place);
  });
});
