import { createFileRoute } from '@tanstack/react-router'

import { getCities, getMyProfile, getStates, type UserProfile } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

import { ProfilePage } from '../components/ProfilePage'

export const Route = createFileRoute('/profile')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { profile, states, cities } = Route.useLoaderData()
    return <ProfilePage locale={locale} profile={profile} states={states} cities={cities} />
  },
  loaderDeps: ({ search }) => ({ country: (search as { country?: string }).country, state: (search as { state?: string }).state }),
  loader: async ({ deps }): Promise<{ profile: UserProfile; states: readonly geo.GeoState[]; cities: readonly geo.GeoCity[] }> => {
    const profile = await getMyProfile()
    const country = deps.country ?? profile.homeMarketCode ?? 'DZ'
    const states = await getStates({ data: { country } })
    const stateParam = deps.state ?? profile.homeState ?? ''
    const cities = stateParam ? await getCities({ data: { country, state: stateParam } }) : []
    return { profile, states, cities }
  },
})
