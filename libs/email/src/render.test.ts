import { type Locale } from '@founders-coffee/i18n';
import { describe, expect, it } from 'vitest';

import { renderEmail } from './render.js';
import { NotificationEmail } from './templates/notification.js';
import { OtpEmail } from './templates/otp.js';

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
    expect(html).toContain(
      'src="https://founders.coffee/branding/pwa-logo.png"',
    );
    expect(html).toContain('alt="Founders Coffee"');
    expect(html).toContain('width="56"');
    expect(html).toContain('height="56"');
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

  it('renders a branded OTP code block in HTML and plain text', async () => {
    const result = await renderEmail(OtpEmail, {
      locale: 'en',
      preview: 'Sign-in code',
      greeting: 'Welcome',
      codeLabel: 'Use this code',
      code: '123456',
      expiry: 'Expires in 30 minutes.',
    });

    expect(result.html).toContain('123456');
    expect(result.html).toContain('Founders Coffee');
    expect(result.text).toContain('123456');
    expect(result.text).toContain('Expires in 30 minutes.');
  });

  it('names the brand once in the footer, in every locale', async () => {
    for (const locale of ['ar', 'en', 'fr'] as const) {
      const { html } = await renderEmail(OtpEmail, {
        locale,
        preview: 'preview',
        greeting: 'greeting',
        codeLabel: 'codeLabel',
        code: '123456',
        expiry: 'expiry',
      });
      const footer = html.slice(html.lastIndexOf('123456'));

      expect(footer.match(/Founders Coffee/gu) ?? [], locale).toHaveLength(1);
    }
  });

  it('keeps em dashes out of what a reader sees', async () => {
    for (const locale of ['ar', 'en', 'fr'] as const) {
      const { html, text } = await renderEmail(OtpEmail, {
        locale,
        preview: 'preview',
        greeting: 'greeting',
        codeLabel: 'codeLabel',
        code: '123456',
        expiry: 'expiry',
      });

      expect(html, `${locale} html`).not.toMatch(/\u2014/);
      expect(text, `${locale} text`).not.toMatch(/\u2014/);
    }
  });
});
