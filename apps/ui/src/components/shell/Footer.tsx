import { Link } from '@tanstack/react-router'
import { Coffee, Heart } from 'lucide-react'

import type { Market } from '@founders-coffee/db'
import {
  brand,
  footer_about,
  footer_company,
  footer_contact,
  footer_cookies,
  footer_copyright_brand,
  footer_copyright_made,
  footer_cta,
  footer_cta_host,
  footer_legal,
  footer_privacy,
  footer_tagline,
  footer_terms,
  nav_communities,
  type Locale,
} from '@founders-coffee/i18n'

import { LocaleToggle } from './LocaleToggle'

type FooterProps = {
  locale: Locale
  markets: readonly Market[]
}

const marketLabel = (market: Market, locale: Locale) =>
  locale === 'ar' ? (market.nameAr ?? market.name) : market.name

const linkClass =
  'text-[0.9375rem] leading-6 text-base-content/65 transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary'

const headingClass =
  'mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-base-content/45'

export const Footer = ({ locale, markets }: FooterProps) => {
  const hostMarket = markets[0]

  return (
    <footer className="mt-20 border-t border-base-300/70 bg-base-200/90">
      <div className="mx-auto max-w-5xl px-4 py-14 md:py-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col lg:col-span-4">
            <Link to="/" className="group inline-flex items-center gap-3 self-start">
              <img
                src="/logo-fc.svg"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="text-lg font-extrabold tracking-tight text-primary">
                {brand({}, { locale })}
              </span>
            </Link>

            <p className="mt-4 max-w-sm text-[0.9375rem] leading-7 text-base-content/60">
              {footer_tagline({}, { locale })}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/" className="btn btn-primary btn-sm h-10 gap-2 px-4 text-[0.875rem] font-semibold shadow-none">
                <Coffee className="size-3.5 opacity-90" aria-hidden="true" />
                {footer_cta({}, { locale })}
              </Link>
              {hostMarket ? (
                <Link
                  to="/$market"
                  params={{ market: hostMarket.slug }}
                  className="btn btn-ghost btn-sm h-10 px-3 text-[0.875rem] font-medium text-base-content/70 hover:bg-base-300/50 hover:text-primary"
                >
                  {footer_cta_host({}, { locale })}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:col-span-8 lg:pt-1">
            <nav aria-label={nav_communities({}, { locale })} className="flex flex-col gap-2.5">
              <h2 className={headingClass}>{nav_communities({}, { locale })}</h2>
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

            <nav aria-label={footer_company({}, { locale })} className="flex flex-col gap-2.5">
              <h2 className={headingClass}>{footer_company({}, { locale })}</h2>
              <Link to="/about" className={linkClass}>
                {footer_about({}, { locale })}
              </Link>
              <Link to="/contact" className={linkClass}>
                {footer_contact({}, { locale })}
              </Link>
            </nav>

            <nav
              aria-label={footer_legal({}, { locale })}
              className="col-span-2 flex flex-col gap-2.5 sm:col-span-1"
            >
              <h2 className={headingClass}>{footer_legal({}, { locale })}</h2>
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
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-base-300/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-6 text-base-content/45">
            <span>{footer_copyright_brand({}, { locale })}</span>
            <Heart
              className="size-3.5 shrink-0 fill-primary/70 text-primary"
              aria-hidden="true"
            />
            <span>{footer_copyright_made({}, { locale })}</span>
          </p>
          <LocaleToggle locale={locale} />
        </div>
      </div>
    </footer>
  )
}
