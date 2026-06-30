import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { market_hero_desc, type Locale } from '@founders-coffee/i18n'
import { getMarketLanding, type MarketWithCities } from '@founders-coffee/server-fns'

import { MarketLanding } from '../../components/MarketLanding'

export const Route = createFileRoute('/$market/')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { market, cities } = Route.useLoaderData()
    return <MarketLanding locale={locale} market={market} cities={cities} />
  },
  loader: async ({ params }): Promise<MarketWithCities> => {
    try {
      const { market, cities } = await getMarketLanding({ data: { key: params.market } })
      if (params.market !== market.slug) {
        throw redirect({ to: '/$market', params: { market: market.slug } })
      }
      return { market, cities }
    } catch (error) {
      if (appErrorCode(error) === 'market_not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.market.name ?? 'founders.coffee'} — founders.coffee` },
      {
        name: 'description',
        content: market_hero_desc({}, { locale: (loaderData?.market.defaultLocale ?? 'ar') as Locale }),
      },
    ],
  }),
})
