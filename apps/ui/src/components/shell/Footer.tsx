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
  footer_legal,
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
  'text-body-sm text-neutral transition-colors hover:text-base-content';

export const Footer = ({ locale, markets }: FooterProps) => (
  <footer className="mt-16 bg-base-200">
    <div className="mx-auto max-w-content px-4 py-12 md:px-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            aria-label={brand({}, { locale })}
            className="w-fit rounded-field"
          >
            <Logo symbolSize={20} textClassName="text-body-sm" />
          </Link>
          <p className="max-w-xs text-caption leading-relaxed text-neutral">
            {footer_tagline({}, { locale })}
          </p>
          <LocaleToggle locale={locale} />
        </div>

        <nav
          aria-label={nav_communities({}, { locale })}
          className="flex flex-col gap-2"
        >
          <h2 className="eyebrow mb-1">{nav_communities({}, { locale })}</h2>
          {(markets ?? []).map((mk) => (
            <Link
              key={mk.code}
              to="/$market"
              params={{ market: mk.slug }}
              className={linkClass}
            >
              {marketLabel(mk, locale)}
            </Link>
          ))}
        </nav>

        <nav
          aria-label={footer_company({}, { locale })}
          className="flex flex-col gap-2"
        >
          <h2 className="eyebrow mb-1">{footer_company({}, { locale })}</h2>
          <Link to="/about" className={linkClass}>
            {footer_about({}, { locale })}
          </Link>
          <Link to="/contact" className={linkClass}>
            {footer_contact({}, { locale })}
          </Link>
        </nav>

        <nav
          aria-label={footer_legal({}, { locale })}
          className="flex flex-col gap-2"
        >
          <h2 className="eyebrow mb-1">{footer_legal({}, { locale })}</h2>
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
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-base-300 pt-6 text-body-sm text-neutral">
        <span>{footer_copyright_brand({}, { locale })}</span>
        <span>{footer_copyright_made({}, { locale })}</span>
      </div>
    </div>
  </footer>
);
