import { Link, createFileRoute } from '@tanstack/react-router'

import type { Market } from '@founders-coffee/db'
import { picker_subtitle, picker_title } from '@founders-coffee/i18n'
import { getVisibleMarkets } from '@founders-coffee/server-fns'
import { Card, CardBody, CardTitle } from '@founders-coffee/ui'

const Home = () => {
  const { locale } = Route.useRouteContext()
  const markets = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-primary">{picker_title({}, { locale })}</h1>
        <p className="mt-3 text-lg text-base-content/70">{picker_subtitle({}, { locale })}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {markets.map((mk) => (
          <Link
            key={mk.code}
            to="/$market"
            params={{ market: mk.slug }}
            className="transition-all hover:-translate-y-0.5"
          >
            <Card className="h-full hover:shadow-md">
              <CardBody>
                <CardTitle>{mk.name}</CardTitle>
                <p className="text-sm text-base-content/60">{mk.defaultLocale.toUpperCase()}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
  loader: (): Promise<Market[]> => getVisibleMarkets(),
})
