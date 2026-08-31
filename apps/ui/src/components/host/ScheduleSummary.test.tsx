import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { host_selected_time, type Locale } from '@founders-coffee/i18n';

import { ScheduleSummary } from './ScheduleSummary';

describe('ScheduleSummary', () => {
  it.each([
    ['ar', 'rtl'],
    ['fr', 'ltr'],
    ['en', 'ltr'],
  ] as const)(
    'renders the numeric market offset in %s with %s direction',
    (locale: Locale, expectedDirection) => {
      const label = host_selected_time({}, { locale });
      const html = renderToStaticMarkup(
        <ScheduleSummary
          startsAt={Date.UTC(2026, 8, 15, 17, 30)}
          endsAt={Date.UTC(2026, 8, 15, 18, 30)}
          locale={locale}
          timeZone="Africa/Algiers"
        />,
      );

      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain(`dir="${expectedDirection}"`);
      expect(html).toContain('18:30');
      expect(html).toContain('19:30');
      expect(html).toContain('01:00');
      expect(html).toContain('Africa/Algiers');
    },
  );
});
