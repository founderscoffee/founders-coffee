import { Body, Container, Head, Hr, Html, Preview, Text } from '@react-email/components';
import { type CSSProperties, type ReactNode } from 'react';
import { direction, type Locale } from '@founders-coffee/i18n';

export interface EmailBaseProps {
  readonly locale: Locale;
  readonly preview: string;
  readonly children: ReactNode;
}

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const bodyStyle: CSSProperties = {
  backgroundColor: '#faf7f2',
  fontFamily: FONT_STACK,
  margin: 0,
  padding: 0,
};

const containerStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  margin: '24px auto',
  maxWidth: '560px',
  padding: '32px',
};

const hrStyle: CSSProperties = {
  borderColor: '#e7e5e4',
  margin: '24px 0',
};

const footerStyle: CSSProperties = {
  color: '#78716c',
  fontSize: '13px',
  textAlign: 'center',
};

/**
 * Shared email shell. Sets `lang` + `dir` from the locale (FR-N3 — RTL for Arabic) via
 * libs/i18n's `direction`. Centered 560px card on the Warm Café neutral background, system-font
 * stack. Every email template composes inside this base.
 */
export const EmailBase = ({ locale, preview, children }: EmailBaseProps) => (
  <Html lang={locale} dir={direction(locale)}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={bodyStyle}>
      <Container style={containerStyle}>
        {children}
        <Hr style={hrStyle} />
        <Text style={footerStyle}>founders.coffee</Text>
      </Container>
    </Body>
  </Html>
);
