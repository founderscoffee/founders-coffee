import { createFileRoute } from '@tanstack/react-router'
import { getCookies } from '@tanstack/react-start/server'

import { getCities, getStates } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

import { OnboardingPage } from '../components/OnboardingPage'

export const Route = createFileRoute('/onboarding')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { states, cities } = Route.useLoaderData()
    return <OnboardingPage locale={locale} states={states} cities={cities} />
  },
  loader: async ({ location }): Promise<{ states: readonly geo.GeoState[]; cities: readonly geo.GeoCity[] }> => {
    const country = new URLSearchParams(location.search).get('country') ?? getCookies()['fc_geo']?.toUpperCase() ?? 'DZ'
    const states = await getStates({ data: { country } })
    const stateParam = new URLSearchParams(location.search).get('state') ?? ''
    const cities = stateParam ? await getCities({ data: { country, state: stateParam } }) : []
    return { states, cities }
  },
})
