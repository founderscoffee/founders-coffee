import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { cities_in, market_hero_desc, market_hero_title, type Locale } from '@founders-coffee/i18n'
import { getMarketLanding, type MarketWithCities } from '@founders-coffee/server-fns'
import { Card, CardBody, CardTitle } from '@founders-coffee/ui'

const MarketLanding = () => {
  const { locale } = Route.useRouteContext()
  const { market, cities } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-primary">
          {market_hero_title({ market: market.name }, { locale })}
        </h1>
        <p className="mt-3 text-lg text-base-content/70">{market_hero_desc({}, { locale })}</p>
      </header>

      <h2 className="mb-4 text-xl font-semibold">{cities_in({ market: market.name }, { locale })}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => (
          <Link
            key={c.id}
            to="/$market/$city"
            params={{ market: market.slug, city: c.slug }}
            className="transition-all hover:-translate-y-0.5"
          >
            <Card className="h-full hover:shadow-md">
              <CardBody>
                <CardTitle>{c.name}</CardTitle>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/$market/')({
  component: MarketLanding,
  loader: async ({ params }): Promise<MarketWithCities> => {
    try {
      const { market, cities } = await getMarketLanding({ data: { key: params.market } })
      /* Canonicalize the code alias to the slug (/dz → /algeria). */
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
