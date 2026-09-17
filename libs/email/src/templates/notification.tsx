import { Button, Section, Text } from '@react-email/components';
import { type CSSProperties } from 'react';
import { type Locale } from '@founders-coffee/i18n';

import { EmailBase } from './base.js';

export interface NotificationEmailProps {
  readonly locale: Locale;
  readonly preview: string;
  readonly bodyHtml?: string;
  readonly greeting?: string;
  readonly lines?: readonly string[];
  readonly cta?: { readonly label: string; readonly href: string };
  readonly footer?: string;
}

const greetingStyle: CSSProperties = {
  color: '#2b1305',
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: '30px',
  margin: '0 0 18px',
};

const lineStyle: CSSProperties = {
  color: '#5e5044',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 12px',
};

const bodyHtmlStyle: CSSProperties = {
  color: '#5e5044',
  fontSize: '16px',
  lineHeight: '26px',
  margin: 0,
};

const mutedStyle: CSSProperties = {
  color: '#8b7b6b',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '24px 0 0',
};

const ctaSectionStyle: CSSProperties = {
  margin: '28px 0 8px',
  textAlign: 'center',
};

const ctaButtonStyle: CSSProperties = {
  backgroundColor: '#c26232',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  padding: '13px 24px',
  textDecoration: 'none',
};

export const NotificationEmail = ({
  locale,
  preview,
  bodyHtml,
  greeting,
  lines,
  cta,
  footer,
}: NotificationEmailProps) => (
  <EmailBase locale={locale} preview={preview}>
    {bodyHtml ? (
      <div
        style={bodyHtmlStyle}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    ) : (
      <>
        {greeting ? <Text style={greetingStyle}>{greeting}</Text> : null}
        {(lines ?? []).map((line) => (
          <Text key={line} style={lineStyle}>
            {line}
          </Text>
        ))}
      </>
    )}
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
