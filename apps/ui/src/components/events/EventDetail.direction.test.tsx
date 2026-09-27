import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import { event, market } from './EventDetail.fixtures';

const { EventDetail } = await import('./EventDetail');

afterEach(() => cleanup());

type Host = Parameters<typeof EventDetail>[0]['host'];

const arabic = {
  ...event,
  title: 'قهوة ونقاش: تمويل المشاريع',
  description: 'نلتقي في الطابق الأول (قرب النافذة).',
} satisfies EventDetailItem;

const show = (item: EventDetailItem, locale: Locale, host: Host = null) =>
  render(
    <EventDetail
      locale={locale}
      market={market}
      event={item}
      host={host}
      isHost={false}
      live={null}
      isWindowOpen={false}
      phase="upcoming"
    />,
  );

describe('what the host wrote, on a page in another direction', () => {
  it.each<Locale>(['fr', 'en'])(
    'lets an Arabic title and description set their own direction on a %s page',
    (locale) => {
      show(arabic, locale);

      expect(
        screen.getByRole('heading', { level: 1 }).getAttribute('dir'),
        'the colon of قهوة ونقاش: landed on the wrong side of its word on a left-to-right page',
      ).toBe('auto');
      expect(screen.getByText(arabic.description).getAttribute('dir')).toBe(
        'auto',
      );
    },
  );

  it('lets the host’s name set its own direction', () => {
    show(event, 'fr', {
      userId: 'usr_1',
      displayName: 'ياسين بن علي',
    } as Host);

    expect(screen.getByText('ياسين بن علي').getAttribute('dir')).toBe('auto');
  });

  it.each([
    ['ar', 'The café closed.', /^سبب الإلغاء: /u],
    ['fr', 'أُغلق المقهى.', /^Motif de l’annulation : /u],
  ] as const)(
    'keeps the cancellation reason apart from the %s sentence around it',
    (locale, reason, lead) => {
      show(
        {
          ...event,
          status: 'cancelled',
          cancelledAt: new Date('2026-09-10T00:00:00Z'),
          cancellationReason: reason,
        },
        locale,
      );

      const isolated = screen.getByText(reason);
      expect(isolated.tagName).toBe('BDI');
      expect(isolated.parentElement?.textContent).toMatch(lead);
    },
  );
});
