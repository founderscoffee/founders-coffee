import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import {
  hero_search_no_match,
  onboarding_search_city,
  profile_edit,
  profile_home_location,
  profile_save,
  role_admin,
  role_host,
  role_member,
  type Locale,
} from '@founders-coffee/i18n'
import type { UserProfile } from '@founders-coffee/server-fns'
import type { geo } from '@founders-coffee/domain'

import { useUpdateProfile } from '../../features/profile/hooks'
import { CitySearchCombobox } from '../ui/CitySearchCombobox'
import type { Market } from '@founders-coffee/db'
import { initials } from '../../lib/utils'

const ROLE_LABELS: Record<string, (l: { locale: string }) => string> = {
  member: () => 'role_member',
  host: () => 'role_host',
  admin: () => 'role_admin',
}

type ProfilePageProps = {
  locale: Locale
  profile: UserProfile
  markets: readonly Market[]
  states: readonly geo.GeoState[]
  cities: readonly geo.GeoCity[]
}

export const ProfilePage = ({ locale, profile, markets, states, cities }: ProfilePageProps) => {
  const navigate = useNavigate()
  const updateProfileMutation = useUpdateProfile()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [country, setCountry] = useState(profile.homeMarketCode ?? 'DZ')
  const [stateVal, setStateVal] = useState(profile.homeState ?? '')
  const [city, setCity] = useState(profile.homeCityId ?? '')

  const roleMsg = ROLE_LABELS[profile.role] ?? ROLE_LABELS.member

  const handleSave = async () => {
    if (!country || !stateVal || !city) return
    setSaving(true)
    await updateProfileMutation.mutateAsync({ data: { marketCode: country, state: stateVal, city } })
    setEditing(false)
    setSaving(false)
    void navigate({ to: '/profile' })
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body gap-4">
          <div className="flex items-center gap-4">
            <div className="avatar avatar-placeholder">
              <div className="w-16 rounded-full bg-neutral text-neutral-content">
                <span className="text-xl font-bold">{initials(profile.name)}</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">{profile.name}</h1>
              <span className="badge badge-sm badge-outline mt-1 gap-1">
                {roleMsg({ locale }) === 'role_member' ? role_member({}, { locale })
                  : roleMsg({ locale }) === 'role_host' ? role_host({}, { locale })
                  : role_admin({}, { locale })}
              </span>
            </div>
          </div>

          <div className="divider" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-base-content/40">
              {profile_home_location({}, { locale })}
            </h2>
            {!editing && (
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>
                {profile_edit({}, { locale })}
              </button>
            )}
          </div>

          {!editing ? (
            <div className="space-y-1 text-sm">
              <p className="text-base-content/70">
                {profile.homeCityNameAr && locale === 'ar' ? profile.homeCityNameAr : profile.homeCityName ?? '-'}
              </p>
              <p className="text-base-content/50">{profile.homeStateName ?? '-'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <select
                className="select select-bordered select-sm"
                value={country}
                onChange={(e) => { setCountry(e.target.value); setStateVal(''); setCity('') }}
              >
                {markets.map((m) => (
                  <option key={m.code} value={m.code}>{locale === 'ar' ? (m.nameAr ?? m.name) : m.name}</option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm"
                value={stateVal}
                onChange={(e) => { setStateVal(e.target.value); setCity('') }}
              >
                <option value="">-</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>{locale === 'ar' ? s.nameAr : s.name}</option>
                ))}
              </select>
              <CitySearchCombobox
                cities={cities}
                value={city}
                onSelect={setCity}
                placeholder={onboarding_search_city({}, { locale })}
                noMatchText={hero_search_no_match({ query: '{query}' }, { locale })}
                disabled={!stateVal}
                locale={locale}
              />
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary btn-sm flex-1" disabled={saving || !country || !stateVal || !city} onClick={handleSave}>
                  {profile_save({}, { locale })}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
              </div>
            </div>
          )}

          <div className="divider" />
          <div className="text-sm text-base-content/60">{profile.email}</div>
        </div>
      </div>
    </div>
  )
}
