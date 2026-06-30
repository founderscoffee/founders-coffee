import { Link } from '@tanstack/react-router'

import {
  back_to_market,
  city_empty_body,
  city_empty_bullet1,
  city_empty_bullet2,
  city_empty_bullet3,
  city_empty_cta,
  city_empty_title,
  type Locale,
} from '@founders-coffee/i18n'
import type { Market } from '@founders-coffee/db'
import type { geo } from '@founders-coffee/domain'

type CityLandingProps = {
  locale: Locale
  market: Market
  city: geo.GeoCity
}

export const CityLanding = ({ locale, market, city }: CityLandingProps) => {
  const cityDisplayName = locale === 'ar' ? city.nameAr : city.name

  return (
    <section className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mb-4 text-6xl" aria-hidden="true">☕</div>
      <h1 className="text-3xl font-extrabold text-primary">
        {city_empty_title({ city: cityDisplayName }, { locale })}
      </h1>
      <p className="mt-3 text-base-content/70">{city_empty_body({}, { locale })}</p>
      <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2 text-sm text-base-content/60">
        <li>{city_empty_bullet1({}, { locale })}</li>
        <li>{city_empty_bullet2({}, { locale })}</li>
        <li>{city_empty_bullet3({}, { locale })}</li>
      </ul>
      <Link to="/login" className="btn btn-primary btn-lg mt-8 gap-1">
        {city_empty_cta({}, { locale })}
      </Link>
      <div className="mt-4">
        <Link
          to="/$market"
          params={{ market: market.slug }}
          className="text-sm text-base-content/40 hover:text-primary"
        >
          {back_to_market({ market: market.name }, { locale })}
        </Link>
      </div>
    </section>
  )
}
