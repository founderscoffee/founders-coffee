import { createFileRoute, notFound } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import { getPublicProfile, type PublicProfile } from '@founders-coffee/server-fns'

import { PublicProfilePage } from '../components/profile/PublicProfilePage'

export const Route = createFileRoute('/u/$userId')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const profile = Route.useLoaderData()
    return <PublicProfilePage locale={locale} profile={profile} />
  },
  loader: async ({ params }): Promise<PublicProfile> => {
    try {
      return await getPublicProfile({ data: { userId: params.userId } })
    } catch (error) {
      if (appErrorCode(error) === 'not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Profile'} - founders.coffee` }],
  }),
})
