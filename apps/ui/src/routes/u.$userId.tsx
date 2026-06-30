import { createFileRoute, notFound } from '@tanstack/react-router'

import { appErrorCode } from '@founders-coffee/core'
import {
  public_events_hosted,
  public_no_events,
  role_admin,
  role_host,
  role_member,
} from '@founders-coffee/i18n'
import { getPublicProfile } from '@founders-coffee/server-fns'

const initials = (name: string): string =>
  name.split(' ').map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase()

const PublicProfilePage = () => {
  const { locale } = Route.useRouteContext()
  const profile = Route.useLoaderData()

  const roleLabel = profile.role === 'host'
    ? role_host({}, { locale })
    : profile.role === 'admin'
      ? role_admin({}, { locale })
      : role_member({}, { locale })

  const cityName = locale === 'ar' ? profile.homeCityNameAr : profile.homeCityName

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body items-center gap-4 text-center">
          <div className="avatar avatar-placeholder">
            <div className="w-20 rounded-full bg-neutral text-neutral-content">
              <span className="text-2xl font-bold">{initials(profile.name)}</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <span className="badge badge-outline badge-sm mt-1">{roleLabel}</span>
          </div>

          {cityName && (
            <p className="text-sm text-base-content/60">{cityName}</p>
          )}

          <div className="divider" />

          {/* Stats (FR-E7 — events hosted; 0 until P1-005) */}
          <div className="stats stats-horizontal bg-base-100 shadow-sm">
            <div className="stat">
              <div className="stat-title text-xs">{public_events_hosted({}, { locale })}</div>
              <div className="stat-value text-2xl">0</div>
            </div>
          </div>

          <p className="text-sm text-base-content/40">{public_no_events({}, { locale })}</p>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/u/$userId')({
  component: PublicProfilePage,
  loader: async ({ params }) => {
    try {
      return await getPublicProfile({ data: { userId: params.userId } })
    } catch (error) {
      if (appErrorCode(error) === 'not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Profile'} — founders.coffee` }],
  }),
})
