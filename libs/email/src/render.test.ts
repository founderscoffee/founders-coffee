import { type Locale } from '@founders-coffee/i18n';
import { describe, expect, it } from 'vitest';

import { renderEmail } from './render.js';
import { NotificationEmail } from './templates/notification.js';

const arProps = {
  locale: 'ar' as Locale,
  preview: 'معاينة الرسالة',
  greeting: 'مرحباً',
  lines: ['السطر الأول من الرسالة', 'السطر الثاني من الرسالة'],
  cta: { label: 'تأكيد الحضور', href: 'https://founders.coffee/rsvp/abc' },
};

describe('renderEmail', () => {
  it('renders the base shell with lang + dir for an RTL locale', async () => {
    const { html } = await renderEmail(NotificationEmail, arProps);

    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
  });

  it('renders localized greeting, lines, and cta into the HTML', async () => {
    const { html } = await renderEmail(NotificationEmail, arProps);

    expect(html).toContain('مرحباً');
    expect(html).toContain('السطر الأول من الرسالة');
    expect(html).toContain('تأكيد الحضور');
    expect(html).toContain('https://founders.coffee/rsvp/abc');
  });

  it('renders a plain-text part containing the body lines', async () => {
    const { text } = await renderEmail(NotificationEmail, arProps);

    expect(text).toContain('السطر الأول من الرسالة');
    expect(text).toContain('السطر الثاني من الرسالة');
  });

  it('renders LTR for a Latin locale', async () => {
    const { html } = await renderEmail(NotificationEmail, {
      locale: 'en',
      preview: 'Message preview',
      greeting: 'Hi there',
      lines: ['Line one'],
    });

    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="ltr"');
  });
});
