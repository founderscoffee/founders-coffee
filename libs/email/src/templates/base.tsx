import {
  Body,
  Container,
  Head,
  Hr,
  Img,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
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
  backgroundColor: '#f5efe7',
  fontFamily: FONT_STACK,
  margin: 0,
  padding: '32px 16px',
};

const containerStyle: CSSProperties = {
  backgroundColor: '#fffdf9',
  border: '1px solid #eadfce',
  borderRadius: '20px',
  margin: '0 auto',
  maxWidth: '600px',
  overflow: 'hidden',
};

const hrStyle: CSSProperties = {
  borderColor: '#eadfce',
  margin: '28px 0 20px',
};

const footerStyle: CSSProperties = {
  color: '#8b7b6b',
  fontSize: '13px',
  lineHeight: '20px',
  margin: 0,
  textAlign: 'center',
};

const headerStyle: CSSProperties = {
  backgroundColor: '#2b1305',
  padding: '22px 32px',
  textAlign: 'center',
};

const brandStyle: CSSProperties = {
  color: '#fffdf9',
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.4px',
  margin: 0,
};

const logoStyle: CSSProperties = {
  backgroundColor: '#fffdf9',
  border: 0,
  borderRadius: '14px',
  display: 'block',
  height: '56px',
  margin: '0 auto 12px',
  outline: 'none',
  padding: '8px',
  textDecoration: 'none',
  width: '56px',
};

const contentStyle: CSSProperties = {
  padding: '36px 40px 8px',
};

const copyrightByLocale: Record<Locale, string> = {
  ar: '© 2026 Founders Coffee — جميع الحقوق محفوظة.',
  en: '© 2026 Founders Coffee — All rights reserved.',
  fr: '© 2026 Founders Coffee — Tous droits réservés.',
};

const EMAIL_LOGO_URL = 'https://founders.coffee/branding/pwa-logo.png';

export const EmailBase = ({ locale, preview, children }: EmailBaseProps) => (
  <Html lang={locale} dir={direction(locale)}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={bodyStyle}>
      <Container style={containerStyle}>
        <Section style={headerStyle}>
          <Img
            src={EMAIL_LOGO_URL}
            alt="Founders Coffee"
            width="56"
            height="56"
            style={logoStyle}
          />
          <Text style={brandStyle}>
            Founders Coffee <span style={{ color: '#c26232' }}>●</span>
          </Text>
        </Section>
        <Section
          style={{
            ...contentStyle,
            textAlign: direction(locale) === 'rtl' ? 'right' : 'left',
          }}
        >
          {children}
        </Section>
        <Section style={{ padding: '0 40px 28px' }}>
          <Hr style={hrStyle} />
          <Text style={footerStyle}>Founders Coffee</Text>
          <Text style={footerStyle}>{copyrightByLocale[locale]}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);
