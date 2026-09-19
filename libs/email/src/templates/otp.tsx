import { Section, Text } from '@react-email/components';
import { type CSSProperties } from 'react';
import { type Locale } from '@founders-coffee/i18n';

import { EmailBase } from './base.js';

export interface OtpEmailProps {
  readonly locale: Locale;
  readonly preview: string;
  readonly greeting: string;
  readonly codeLabel: string;
  readonly code: string;
  readonly expiry: string;
}

const greetingStyle: CSSProperties = {
  color: '#2b1305',
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: '30px',
  margin: '0 0 12px',
};

const labelStyle: CSSProperties = {
  color: '#5e5044',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 14px',
};

const codeStyle: CSSProperties = {
  backgroundColor: '#f5efe7',
  border: '1px solid #eadfce',
  borderRadius: '12px',
  color: '#2b1305',
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '8px',
  lineHeight: '44px',
  margin: '0 0 14px',
  padding: '16px',
  textAlign: 'center',
};

const expiryStyle: CSSProperties = {
  color: '#8b7b6b',
  fontSize: '14px',
  lineHeight: '22px',
  margin: 0,
};

export const OtpEmail = ({
  locale,
  preview,
  greeting,
  codeLabel,
  code,
  expiry,
}: OtpEmailProps) => (
  <EmailBase locale={locale} preview={preview}>
    <Text style={greetingStyle}>{greeting}</Text>
    <Text style={labelStyle}>{codeLabel}</Text>
    <Section>
      <Text style={codeStyle}>{code}</Text>
    </Section>
    <Text style={expiryStyle}>{expiry}</Text>
  </EmailBase>
);
