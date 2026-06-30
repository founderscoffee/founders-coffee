import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { city_empty_body, type Locale } from '@founders-coffee/i18n'
import { getCityLanding, type MarketCity } from '@founders-coffee/server-fns'

import { CityLanding } from '../components/CityLanding'

export const Route = createFileRoute('/$market/$city')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { market, city } = Route.useLoaderData()
    return <CityLanding locale={locale} market={market} city={city} />
  },
  loader: async ({ params }): Promise<MarketCity> => {
    try {
      const { market, city } = await getCityLanding({
        data: { marketKey: params.market, citySlug: params.city },
      })
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
