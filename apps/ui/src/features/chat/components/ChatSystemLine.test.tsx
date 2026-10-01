import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { chat } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';

import { ChatSystemLine } from './ChatSystemLine';

afterEach(cleanup);

const show = (notice: chat.ChatSystemNotice | null, locale: Locale = 'en') =>
  render(
    <ChatSystemLine
      locale={locale}
      timeZone="Africa/Algiers"
      notice={notice}
    />,
  ).container;

const isolatedIn = (container: HTMLElement) =>
  [...container.querySelectorAll('bdi')].map((node) => node.textContent);

describe('ChatSystemLine', () => {
  it('gives a new start in the market’s time zone, and where it is', () => {
    const container = show({
      key: 'rescheduled',
      params: {
        startsAt: '2026-10-15T18:00:00.000Z',
        venue: 'Café des Délices',
      },
    });

    expect(container.textContent).toBe(
      'The host has moved the meetup. It now starts Thursday, October 15 at 19:00 at Café des Délices.',
    );
    expect(isolatedIn(container)).toEqual([
      'Thursday, October 15 at 19:00',
      'Café des Délices',
    ]);
  });

  it('gives a new place with its address, each set apart, in the reader’s language', () => {
    const container = show(
      {
        key: 'relocated',
        params: {
          venue: 'Café des Délices',
          address: '12 Rue Didouche Mourad, Alger',
        },
      },
      'fr',
    );

    expect(container.textContent).toBe(
      'L’hôte a déplacé la rencontre vers un nouveau lieu : Café des Délices, 12 Rue Didouche Mourad, Alger. L’horaire ne change pas.',
    );
    expect(isolatedIn(container)).toEqual([
      'Café des Délices',
      '12 Rue Didouche Mourad, Alger',
    ]);
  });

  it('gives a new place by its venue alone when it came with no address', () => {
    const container = show(
      { key: 'relocated', params: { venue: 'Café des Délices' } },
      'ar',
    );

    expect(container.textContent).toBe(
      'غيّر المضيف مكان اللقاء. المكان الجديد: Café des Délices. الموعد كما هو.',
    );
    expect(isolatedIn(container)).toEqual(['Café des Délices']);
  });

  it('says the meetup is off, with the host’s reason on a line of its own', () => {
    const container = show(
      { key: 'cancelled', params: { reason: 'Venue closed.' } },
      'ar',
    );

    expect(
      [...container.querySelectorAll('p')].map((line) => line.textContent),
    ).toEqual([
      'ألغى المضيف اللقاء. لا داعي للحضور.',
      'سبب الإلغاء: Venue closed.',
    ]);
    expect(
      isolatedIn(container),
      'a Latin reason ending in a full stop inside an Arabic sentence drew the stop on the wrong side',
    ).toEqual(['Venue closed.']);
  });

  it('says the meetup is off, and no more, when the host gave no reason', () => {
    const container = show({ key: 'cancelled', params: {} });

    expect(
      [...container.querySelectorAll('p')].map((line) => line.textContent),
    ).toEqual(['The host cancelled the meetup. There is no need to go.']);
  });

  it('says the meetup changed when this screen cannot read what changed', () => {
    const container = show(null);

    expect(container.textContent).toBe('The meetup’s details changed.');
  });
});
