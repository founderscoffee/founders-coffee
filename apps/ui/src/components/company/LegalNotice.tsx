import { Link } from '@tanstack/react-router';

import {
  auth_legal_notice,
  footer_privacy,
  footer_terms,
  type Locale,
} from '@founders-coffee/i18n';

import { localizedLanding } from '../../lib/locale-routing';

type LegalNoticeProps = {
  locale: Locale;
  className?: string;
};

export const LegalNotice = ({ locale, className = '' }: LegalNoticeProps) => {
  const template = auth_legal_notice(
    { privacy: '<<PRIVACY>>', terms: '<<TERMS>>' },
    { locale },
  );
  const parts = template.split(/(<<PRIVACY>>|<<TERMS>>)/g);

  return (
    <p
      className={`text-center text-caption leading-5 text-neutral ${className}`.trim()}
    >
      {parts.map((part, i) => {
        if (part === '<<PRIVACY>>') {
          return (
            <Link
              key={`privacy-${i}`}
              {...localizedLanding(locale, 'privacy')}
              className="font-medium text-neutral underline underline-offset-2 hover:text-primary"
            >
              {footer_privacy({}, { locale })}
            </Link>
          );
        }
        if (part === '<<TERMS>>') {
          return (
            <Link
              key={`terms-${i}`}
              {...localizedLanding(locale, 'terms')}
              className="font-medium text-neutral underline underline-offset-2 hover:text-primary"
            >
              {footer_terms({}, { locale })}
            </Link>
          );
        }
        return <span key={`text-${i}`}>{part}</span>;
      })}
    </p>
  );
};
