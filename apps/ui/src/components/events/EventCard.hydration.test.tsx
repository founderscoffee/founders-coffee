import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { event } from './EventCard.fixtures';
import { hydrate, serverHtml, unmountHydrated } from './hydration.fixtures';

const { EventCard } = await import('./EventCard');

const formatters = Intl.DateTimeFormat.prototype as unknown as {
  format: unknown;
};
const formatOf = Object.getOwnPropertyDescriptor(formatters, 'format')?.get;

const withApplesArabicShortWeekdays = () =>
  vi
    .spyOn(formatters, 'format', 'get')
    // eslint-disable-next-line no-restricted-syntax -- a getter's `this` is the formatter it was read from, which an arrow function cannot see.
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      const format = formatOf?.call(this) as (date?: Date | number) => string;
      const { locale, weekday } = this.resolvedOptions();
      return (date?: Date | number) =>
        locale === 'ar' && weekday === 'short'
          ? format(date).replace(/^ال/u, '')
          : format(date);
    });

const sentDate = (html: string) => {
  const page = document.createElement('template');
  page.innerHTML = html;
  return page.content.querySelector('time')?.textContent;
};

afterEach(() => {
  vi.restoreAllMocks();
  unmountHydrated();
});

describe('a meetup card the server renders and an iPhone hydrates', () => {
  it.each<Locale>([...LOCALES])(
    'hydrates the date the server wrote, in %s',
    async (locale) => {
      const card = (
        <EventCard
          event={event}
          locale={locale}
          timezone="Africa/Algiers"
          marketSlug="algeria"
        />
      );
      const html = serverHtml(card);
      withApplesArabicShortWeekdays();

      const { container, reported } = await hydrate(card, html);

      expect(
        reported,
        'Apple’s ICU, under every browser on an iPhone, writes a short Arabic weekday without its article (جمعة for الجمعة), so the card hydrated with other text than the server sent and React threw the page away: minified error #418 from every iPhone that opened an Arabic landing on 2026-10-01',
      ).toEqual([]);
      expect(container.querySelector('time')?.textContent).toBe(sentDate(html));
    },
  );
});
