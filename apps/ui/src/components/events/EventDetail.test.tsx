import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import { event, market } from './EventDetail.fixtures';

const { EventDetail } = await import('./EventDetail');

afterEach(() => cleanup());

describe('EventDetail structured data ownership', () => {
  it('does not emit a second body-level JSON-LD payload', () => {
    const { container } = render(
      <EventDetail
        locale="en"
        market={market}
        event={event}
        host={null}
        isHost={false}
        live={null}
        isWindowOpen={false}
      />,
    );

    expect(
      container.querySelectorAll('script[type="application/ld+json"]'),
    ).toHaveLength(0);
  });
});

const cancelled = {
  ...event,
  status: 'cancelled',
  goingCount: 3,
  cancelledAt: new Date('2026-09-10T00:00:00Z'),
  cancellationReason: 'The café closed without warning.',
} satisfies EventDetailItem;

const show = (item: EventDetailItem, locale: Locale = 'en', isHost = false) =>
  render(
    <EventDetail
      locale={locale}
      market={market}
      event={item}
      host={null}
      isHost={isHost}
      live={null}
      isWindowOpen={false}
    />,
  );

describe('EventDetail once the host has called the meetup off', () => {
  it('counts the people coming while the meetup is still on', () => {
    show({ ...event, goingCount: 3 });
    expect(screen.getByText('+3 going')).toBeTruthy();
  });

  it('stops advertising an audience for a meetup nobody can attend', () => {
    show(cancelled);
    expect(screen.getByRole('alert').className).toContain('alert-error');
    expect(screen.queryByText('+3 going')).toBeNull();
  });

  it('does not invite a stranger to save a spot at it', () => {
    show(cancelled);
    expect(screen.queryByText('Save your place')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Your attendance' }),
    ).toBeNull();
  });

  it('still has a place to address whoever had said they were coming', () => {
    show({ ...cancelled, viewerRsvp: 'going' });
    expect(
      screen.getByRole('heading', { name: 'Your attendance' }),
    ).toBeTruthy();
  });
});

describe('the share chip in the event header', () => {
  it('reads as an imperative, because it is a button and not a heading', () => {
    show(event, 'ar');

    expect(screen.getByRole('button', { name: 'شارك' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'مشاركة' }),
      'مشاركة is the verbal noun and belongs to the dialog heading, not to a control the reader presses',
    ).toBeNull();
  });

  it("is the page's single share affordance", () => {
    show(event, 'ar');

    expect(screen.getAllByRole('button', { name: 'شارك' })).toHaveLength(1);
  });

  it('does not offer to promote a meetup that is off', () => {
    show(cancelled, 'ar');

    expect(screen.queryByRole('button', { name: 'شارك' })).toBeNull();
  });
});

describe('what the seat box calls itself', () => {
  it('names the status once the reader is going, not the action they already took', () => {
    show({ ...event, viewerRsvp: 'going' }, 'ar');

    expect(screen.getByRole('heading', { name: 'حضورك مؤكَّد' })).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'احجز مكانك' }),
      'telling someone to book a place directly above the confirmation that they booked it is the box arguing with itself',
    ).toBeNull();
  });

  it('still asks for the booking from a reader who has not made one', () => {
    show(event, 'ar');

    expect(screen.getByRole('heading', { name: 'احجز مكانك' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'حضورك مؤكَّد' })).toBeNull();
  });

  it('does not claim a confirmed seat at a meetup that is off', () => {
    show({ ...cancelled, viewerRsvp: 'going' }, 'ar');

    expect(screen.getByRole('heading', { name: 'حضورك' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'حضورك مؤكَّد' })).toBeNull();
  });
});

describe('whose clock the When block says the time is on', () => {
  it.each([
    [
      'ar',
      '\u0627\u0644\u062a\u0648\u0642\u064a\u062a \u0627\u0644\u0645\u062d\u0644\u064a \u0641\u064a \u0627\u0644\u062c\u0632\u0627\u0626\u0631',
    ],
    ['en', 'Local time in Algeria'],
    ['fr', 'Heure locale d\u2019Alg\u00e9rie'],
  ] as const)('names the market in %s', (locale, label) => {
    show(event, locale);

    expect(screen.getByText(label)).toBeTruthy();
    expect(
      screen.queryByText(market.timezone),
      'an IANA identifier is a developer string that no locale translates',
    ).toBeNull();
  });
});

const hostHeadings = (view: ReturnType<typeof show>) =>
  view.queryAllByRole('heading', { name: 'Host' }).length;

describe('how often the event page says who is hosting', () => {
  it('names the host once, even when the host is the one reading', () => {
    const view = show(event, 'en', true);

    expect(
      hostHeadings(view),
      'the card is labelled Host, and the aside reused that word for its own heading, so the page said it twice with a different thing under each',
    ).toBe(1);
    expect(
      screen.getByRole('heading', { name: 'Your meetup' }),
      'the aside still needs a heading, and what it holds is the meetup the reader is running',
    ).toBeTruthy();
  });

  it('leaves the label on the card for a reader who is not the host', () => {
    const view = show(event);

    expect(hostHeadings(view)).toBe(1);
    expect(screen.queryByRole('heading', { name: 'Your meetup' })).toBeNull();
  });
});

describe('what the link back to the city says', () => {
  it('names the city the way a French reader knows it', () => {
    show({ ...event, cityName: 'Cairo', cityNameFr: 'Le Caire' }, 'fr');

    expect(
      screen.getByRole('link', { name: 'Retour au Caire' }),
      'the link named the city in English, Retour à Cairo',
    ).toBeTruthy();
  });
});
