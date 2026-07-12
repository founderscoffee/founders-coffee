import { Link } from '@tanstack/react-router'

import type { Market } from '@founders-coffee/db'
import {
  brand,
  footer_about,
  footer_company,
  footer_contact,
  footer_copyright,
  footer_partners,
  footer_privacy,
  footer_sponsors_disclosed,
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

export const Footer = ({ locale, markets }: FooterProps) => (
  <footer className="mt-16 border-t border-base-300 bg-base-200">
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="text-lg font-extrabold text-primary">
            {brand({}, { locale })}
          </Link>
          <p className="mt-2 max-w-xs text-sm text-base-content/60">
            {footer_tagline({}, { locale })}
          </p>
        </div>
        <nav className="flex flex-col gap-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
            {nav_communities({}, { locale })}
          </h2>
          {(markets ?? []).map((mk) => (
            <Link
              key={mk.code}
              to="/$market"
              params={{ market: mk.slug }}
              className="text-sm text-base-content/60 hover:text-primary"
            >
              {mk.name}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
            {footer_company({}, { locale })}
          </h2>
          <a href="/about" className="text-sm text-base-content/60 hover:text-primary">
            {footer_about({}, { locale })}
          </a>
          <a href="/contact" className="text-sm text-base-content/60 hover:text-primary">
            {footer_contact({}, { locale })}
          </a>
          <a href="/privacy" className="text-sm text-base-content/60 hover:text-primary">
            {footer_privacy({}, { locale })}
          </a>
          <a href="/terms" className="text-sm text-base-content/60 hover:text-primary">
            {footer_terms({}, { locale })}
          </a>
        </nav>
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
            {footer_partners({}, { locale })}
          </h2>
          <p className="text-sm italic text-base-content/50">
            {footer_sponsors_disclosed({}, { locale })}
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-base-300 pt-6">
        <p className="text-sm text-base-content/40">{footer_copyright({}, { locale })}</p>
        <LocaleToggle locale={locale} />
        <div className="flex gap-2">
          <a href="#" aria-label="X" className="btn btn-circle btn-ghost btn-sm">𝕏</a>
          <a href="#" aria-label="LinkedIn" className="btn btn-circle btn-ghost btn-sm">in</a>
          <a href="#" aria-label="reddit" className="btn btn-circle btn-ghost btn-sm">r/</a>
        </div>
      </div>
    </div>
  </footer>
)
