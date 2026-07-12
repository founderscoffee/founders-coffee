import { SearchBox } from '@mapbox/search-js-react'

import { host_venue_search_ph, type Locale } from '@founders-coffee/i18n'

import type { VenueSelection } from './HostMap'

type VenueSearchProps = {
  accessToken: string
  locale: Locale
  cityName: string
  marketIso: string
  value: string
  onChange: (v: string) => void
  onVenueSelect: (v: VenueSelection) => void
}

/** Thin client-only wrapper around the Mapbox `<SearchBox>` (kept out of the SSR bundle). */
export const VenueSearch = ({ accessToken, locale, cityName, marketIso, value, onChange, onVenueSelect }: VenueSearchProps) => (
  <SearchBox
    accessToken={accessToken}
    options={{ language: locale, country: marketIso }}
    placeholder={host_venue_search_ph({ city: cityName }, { locale })}
    value={value}
    onChange={onChange}
    onClear={() => onChange('')}
    onRetrieve={(res) => {
      const f = res.features?.[0]
      if (!f) return
      const [lng, lat] = f.geometry.coordinates
      const p = f.properties as { name?: string; full_address?: string; place_name?: string }
      onVenueSelect({
        name: p.name ?? p.full_address ?? 'Venue',
        address: p.full_address ?? p.place_name ?? '',
        lat,
        lng,
      })
    }}
  />
)
