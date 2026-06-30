import { createFileRoute } from '@tanstack/react-router'
import { getCookies } from '@tanstack/react-start/server'

import { getStates } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

import { HostCreatePage } from '../components/HostCreatePage'
import { COUNTRIES } from '../lib/constants'

export const Route = createFileRoute('/host/create')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { states, cities, mapboxToken } = Route.useLoaderData()
    return <HostCreatePage locale={locale} states={states} cities={cities} mapboxToken={mapboxToken} />
  },
  loader: async (): Promise<{
    states: readonly geo.GeoState[]
    cities: readonly geo.GeoCity[]
    mapboxToken: string
  }> => {
    const geoCookie = getCookies()['fc_geo'] ?? 'algeria'
    const country = COUNTRIES.find((c) => c.code === geoCookie.toUpperCase())?.code ?? 'DZ'
    const states = await getStates({ data: { country } })
    const cities: readonly geo.GeoCity[] = []
    const mapboxToken = (getCookies() as Record<string, string>).MAPBOX_TOKEN ?? ''
    return { states, cities, mapboxToken }
  },
})
