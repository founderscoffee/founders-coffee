import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';

import {
  brand,
  footer_about,
  footer_activity,
  footer_report,
  footer_company,
  footer_contact,
  footer_community,
  footer_cookies,
  footer_copyright_brand,
  footer_copyright_made,
  footer_cta,
  footer_cta_host,
  footer_faq,
  footer_legal,
  footer_legal_info,
  footer_organizers,
  footer_participate,
  footer_privacy,
  footer_tagline,
  footer_terms,
  localizedName,
  type Locale,
  type LocalizedNames,
} from '@founders-coffee/i18n';
import { Logo } from '@founders-coffee/ui';

import { LEGAL_PAGE_KEYS, type LegalPageKey } from '../../content/company';
import {
  localizedHostCreate,
  localizedHome,
  localizedLanding,
} from '../../lib/locale-routing';

import { LocaleToggle } from './LocaleToggle';

type FooterProps = {
  locale: Locale;
  markets: readonly FooterMarket[];
  market?: FooterMarket;
};

type FooterMarket = LocalizedNames & {
  readonly code: string;
  readonly slug: string;
};

type FooterNavGroupProps = {
  id: string;
  title: string;
  children: ReactNode;
};

const linkClass =
  'inline-flex min-h-11 items-center text-body-sm text-neutral transition-colors hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

const LEGAL_LABELS: Record<LegalPageKey, typeof footer_terms> = {
  terms: footer_terms,
  privacy: footer_privacy,
  cookies: footer_cookies,
  community: footer_community,
  organizers: footer_organizers,
  legal: footer_legal_info,
};

export const LEGAL_LINKS = LEGAL_PAGE_KEYS.map((key) => ({
  key,
  label: LEGAL_LABELS[key],
}));

const FooterNavGroup = ({ id, title, children }: FooterNavGroupProps) => (
  <>
    <nav aria-labelledby={`${id}-desktop`} className="hidden md:block">
      <h2
        id={`${id}-desktop`}
        className="mb-4 text-label font-semibold uppercase tracking-[0.08em] text-base-content"
      >
        {title}
      </h2>
      <ul className="flex flex-col items-start gap-1">{children}</ul>
    </nav>
    <details className="border-b border-base-300 py-3 md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-body font-semibold text-base-content [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span aria-hidden="true" className="text-body-lg text-neutral">
          +
        </span>
      </summary>
      <nav aria-label={title}>
        <ul className="flex flex-col items-start gap-1 pb-2 ps-2 pt-2">
          {children}
        </ul>
      </nav>
    </details>
  </>
);

export const Footer = ({ locale, markets, market }: FooterProps) => {
  const primaryMarket = market ?? markets[0];
  const primaryMarketLabel = primaryMarket
    ? localizedName(primaryMarket, locale)
    : '';

  return (
    <footer className="mt-16 bg-base-200">
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-14">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-[minmax(15rem,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col items-start gap-4 md:col-span-3 lg:col-span-1">
            <Link
              {...localizedHome(locale, primaryMarket?.slug)}
              aria-label={brand({}, { locale })}
              className="w-fit rounded-field"
            >
              <Logo symbolSize={55} textClassName="text-body-lg" />
            </Link>
            <p className="max-w-xs text-body-sm leading-relaxed text-neutral">
              {footer_tagline({ market: primaryMarketLabel }, { locale })}
            </p>
            <Link
              {...localizedHome(locale, primaryMarket?.slug)}
              className="btn btn-primary h-11 min-h-11 rounded-full border-0 px-5 text-body-sm shadow-none"
            >
              {footer_cta({}, { locale })}
            </Link>
          </div>

          <FooterNavGroup
            id="footer-participate"
            title={footer_participate({}, { locale })}
          >
            {primaryMarket ? (
              <li>
                <Link
                  {...localizedHostCreate(locale, primaryMarket.slug)}
                  className={linkClass}
                >
                  {footer_cta_host({}, { locale })}
                </Link>
              </li>
            ) : null}
            <li>
              <Link to="/profile/activity" className={linkClass}>
                {footer_activity({}, { locale })}
              </Link>
            </li>
            <li>
              <Link
                {...localizedLanding(locale, 'contact')}
                hash="report"
                className={linkClass}
              >
                {footer_report({}, { locale })}
              </Link>
            </li>
          </FooterNavGroup>

          <FooterNavGroup
            id="footer-legal"
            title={footer_legal({}, { locale })}
          >
            {LEGAL_LINKS.map((item) => (
              <li key={item.key}>
                <Link
                  {...localizedLanding(locale, item.key)}
                  className={linkClass}
                >
                  {item.label({}, { locale })}
                </Link>
              </li>
            ))}
          </FooterNavGroup>

          <FooterNavGroup
            id="footer-company"
            title={footer_company({}, { locale })}
          >
            <li>
              <Link
                {...localizedLanding(locale, 'about')}
                className={linkClass}
              >
                {footer_about({}, { locale })}
              </Link>
            </li>
            <li>
              <Link {...localizedLanding(locale, 'faq')} className={linkClass}>
                {footer_faq({}, { locale })}
              </Link>
            </li>
            <li>
              <Link
                {...localizedLanding(locale, 'contact')}
                className={linkClass}
              >
                {footer_contact({}, { locale })}
              </Link>
            </li>
          </FooterNavGroup>
        </div>

        <div className="mt-10 border-t border-base-300 pt-6">
          <div className="flex flex-col items-center gap-5 md:flex-row md:justify-between">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-caption text-neutral md:justify-start">
              <span>{footer_copyright_brand({}, { locale })}</span>
              <span>{footer_copyright_made({}, { locale })}</span>
            </div>

            <LocaleToggle locale={locale} />
          </div>
        </div>
      </div>
    </footer>
  );
};
