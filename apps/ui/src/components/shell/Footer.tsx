import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import {
  brand,
  footer_about,
  footer_company,
  footer_contact,
  footer_cookies,
  footer_copyright_brand,
  footer_copyright_made,
  footer_privacy,
  footer_tagline,
  footer_terms,
  nav_communities,
  type Locale,
} from '@founders-coffee/i18n';
import { Logo } from '@founders-coffee/ui';

import { LocaleToggle } from './LocaleToggle';

type FooterProps = {
  locale: Locale;
  markets: readonly Market[];
};

const marketLabel = (market: Market, locale: Locale) =>
  locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

const linkClass =
  'inline-flex min-h-6 items-center text-body-sm text-neutral transition-colors hover:text-base-content';

export const Footer = ({ locale, markets }: FooterProps) => (
  <footer className="mt-16 bg-base-200">
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/"
          aria-label={brand({}, { locale })}
          className="w-fit rounded-field"
        >
          <Logo symbolSize={20} textClassName="text-body-sm" />
        </Link>
        <p className="text-caption text-neutral">
          {footer_tagline({}, { locale })}
        </p>
      </div>

      <nav
        aria-label={footer_company({}, { locale })}
        className="flex flex-wrap items-center gap-x-5 gap-y-2"
      >
        <Link to="/about" className={linkClass}>
          {footer_about({}, { locale })}
        </Link>
        <Link to="/contact" className={linkClass}>
          {footer_contact({}, { locale })}
        </Link>
        <Link to="/privacy" className={linkClass}>
          {footer_privacy({}, { locale })}
        </Link>
        <Link to="/terms" className={linkClass}>
          {footer_terms({}, { locale })}
        </Link>
        <Link to="/cookies" className={linkClass}>
          {footer_cookies({}, { locale })}
        </Link>
      </nav>

      <LocaleToggle locale={locale} />
    </div>

    <div className="mx-auto max-w-content px-4 pb-6 md:px-8">
      <nav
        aria-label={nav_communities({}, { locale })}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-base-300 pt-5 text-caption text-neutral"
      >
        <span>{footer_copyright_brand({}, { locale })}</span>
        <span>{footer_copyright_made({}, { locale })}</span>
        {(markets ?? []).map((mk) => (
          <Link
            key={mk.code}
            to="/$market"
            params={{ market: mk.slug }}
            className="inline-flex min-h-6 items-center transition-colors hover:text-base-content"
          >
            {marketLabel(mk, locale)}
          </Link>
        ))}
      </nav>
    </div>
  </footer>
);
