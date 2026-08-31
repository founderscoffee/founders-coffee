import { Link } from '@tanstack/react-router';

import {
  auth_legal_notice,
  footer_privacy,
  footer_terms,
  type Locale,
} from '@founders-coffee/i18n';

type LegalNoticeProps = {
  locale: Locale;
  className?: string;
};

/**
 * Compact Privacy + Terms notice for data-capture surfaces (login OTP, waitlist).
 * Message uses <<PRIVACY>> / <<TERMS>> markers replaced with linked labels.
 */
export const LegalNotice = ({ locale, className = '' }: LegalNoticeProps) => {
  const template = auth_legal_notice(
    { privacy: '<<PRIVACY>>', terms: '<<TERMS>>' },
    { locale },
  );
  const parts = template.split(/(<<PRIVACY>>|<<TERMS>>)/g);

  return (
    <p
      className={`text-center text-xs leading-5 text-base-content/50 ${className}`.trim()}
    >
      {parts.map((part, i) => {
        if (part === '<<PRIVACY>>') {
          return (
            <Link
              key={`privacy-${i}`}
              to="/privacy"
              className="font-medium text-base-content/70 underline underline-offset-2 hover:text-primary"
            >
              {footer_privacy({}, { locale })}
            </Link>
          );
        }
        if (part === '<<TERMS>>') {
          return (
            <Link
              key={`terms-${i}`}
              to="/terms"
              className="font-medium text-base-content/70 underline underline-offset-2 hover:text-primary"
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
