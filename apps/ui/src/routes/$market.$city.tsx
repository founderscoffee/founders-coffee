import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
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
import { getCityLanding, type MarketCity } from '@founders-coffee/server-fns'

const CityLanding = () => {
  const { locale } = Route.useRouteContext()
  const { market, city } = Route.useLoaderData()
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

export const Route = createFileRoute('/$market/$city')({
  component: CityLanding,
  loader: async ({ params }): Promise<MarketCity> => {
    try {
      const { market, city } = await getCityLanding({
        data: { marketKey: params.market, citySlug: params.city },
      })
      /* Canonicalize the code alias (/dz/algiers → /algeria/algiers). */
      if (params.market !== market.slug) {
        throw redirect({ to: '/$market/$city', params: { market: market.slug, city: params.city } })
      }
      return { market, city }
    } catch (error) {
      const code = appErrorCode(error)
      if (code === 'market_not_found' || code === 'city_not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.city.name ?? 'founders.coffee'} — founders.coffee` },
      {
        name: 'description',
        content: city_empty_body({}, { locale: (loaderData?.market.defaultLocale ?? 'ar') as Locale }),
      },
    ],
  }),
})
