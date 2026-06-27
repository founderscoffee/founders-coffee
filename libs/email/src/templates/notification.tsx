import { Button, Section, Text } from '@react-email/components';
import { type CSSProperties } from 'react';
import { type Locale } from '@founders-coffee/i18n';

import { EmailBase } from './base.js';

export interface NotificationEmailProps {
  readonly locale: Locale;
  readonly preview: string;
  readonly greeting: string;
  readonly lines: readonly string[];
  readonly cta?: { readonly label: string; readonly href: string };
  readonly footer?: string;
}

const greetingStyle: CSSProperties = {
  color: '#1c1917',
  fontSize: '18px',
  fontWeight: 600,
};

const lineStyle: CSSProperties = {
  color: '#44403c',
  fontSize: '15px',
  lineHeight: '24px',
};

const mutedStyle: CSSProperties = {
  color: '#78716c',
  fontSize: '13px',
};

const ctaSectionStyle: CSSProperties = {
  margin: '24px 0',
  textAlign: 'center',
};

const ctaButtonStyle: CSSProperties = {
  backgroundColor: '#b45309',
  borderRadius: '8px',
  color: '#ffffff',
  padding: '12px 24px',
  textDecoration: 'none',
};

/**
 * Example localized notification email proving the render pipeline + RTL path. Localized text is
 * passed in as props (the caller resolves strings via libs/i18n `m` at P1-009); this template is
 * pure layout. The full template set (RSVP, reminder, host, sponsorship) lands at P1-009.
 */
export const NotificationEmail = ({
  locale,
  preview,
  greeting,
  lines,
  cta,
  footer,
}: NotificationEmailProps) => (
  <EmailBase locale={locale} preview={preview}>
    <Text style={greetingStyle}>{greeting}</Text>
    {lines.map((line) => (
      <Text key={line} style={lineStyle}>
        {line}
      </Text>
    ))}
    {cta ? (
      <Section style={ctaSectionStyle}>
        <Button style={ctaButtonStyle} href={cta.href}>
          {cta.label}
        </Button>
      </Section>
    ) : null}
    {footer ? <Text style={mutedStyle}>{footer}</Text> : null}
  </EmailBase>
);
