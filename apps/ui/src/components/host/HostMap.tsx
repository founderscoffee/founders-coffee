import { Crosshair, Minus, Plus } from 'lucide-react'
import mapboxgl from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { Map, Marker } from 'react-map-gl/mapbox'

import { host_locate_me, host_selected_location, type Locale } from '@founders-coffee/i18n'
import type { geo } from '@founders-coffee/domain'

export interface VenueSelection {
  name: string
  address: string
  lat: number
  lng: number
}

const COUNTRY_CENTERS: Record<string, { lat: number; lng: number }> = {
  DZ: { lat: 28.0339, lng: 1.6596 },
  EG: { lat: 26.8206, lng: 30.8025 },
  SA: { lat: 23.8859, lng: 45.0792 },
}

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'

type Coord = { lng: number; lat: number }

type HostMapProps = {
  accessToken: string
  venue: VenueSelection | null
  city: geo.GeoCity
  marketCode: string
  locale: Locale
  onVenueSelect: (v: VenueSelection) => void
}

const tryGeolocation = (): Promise<Coord | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000 },
    )
  })

const geocodeCity = async (token: string, name: string, iso: string): Promise<Coord | null> => {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(name)}.json?country=${iso}&limit=1&access_token=${token}`,
    )
    const data = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> }
    const c = data.features?.[0]?.geometry?.coordinates
    return c ? { lng: c[0], lat: c[1] } : null
  } catch {
    return null
  }
}

const reverseGeocode = async (token: string, lng: number, lat: number): Promise<{ name: string; address: string } | null> => {
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&access_token=${token}`)
    const data = (await res.json()) as { features?: Array<{ place_name?: string; properties?: { name?: string }; text?: string }> }
    const f = data.features?.[0]
    if (!f) return null
    const name = f.properties?.name ?? f.text ?? 'Location'
    return { name, address: f.place_name ?? name }
  } catch {
    return null
  }
}

const CONTROL_CLS =
  'flex h-11 w-11 items-center justify-center rounded-xl border border-base-300/60 bg-base-100/85 text-base-content shadow-lg backdrop-blur-md transition hover:bg-base-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/40'

export const HostMap = ({ accessToken, venue, city, marketCode, locale, onVenueSelect }: HostMapProps) => {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const countryCenter = COUNTRY_CENTERS[marketCode] ?? COUNTRY_CENTERS.DZ
  const marketIso = marketCode.toLowerCase()
  const cityName = locale === 'ar' ? city.nameAr : city.name
  const [initial] = useState(() =>
    venue ? { longitude: venue.lng, latitude: venue.lat, zoom: 15 } : { longitude: countryCenter.lng, latitude: countryCenter.lat, zoom: 5 },
  )

  const flyTo = (lng: number, lat: number, zoom: number) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 })

  const handleLoad = async () => {
    if (venue) return
    const geo = await tryGeolocation()
    if (geo) return flyTo(geo.lng, geo.lat, 13)
    const c = await geocodeCity(accessToken, cityName, marketIso)
    if (c) flyTo(c.lng, c.lat, 11)
  }

  useEffect(() => {
    if (venue) flyTo(venue.lng, venue.lat, 15)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.lng, venue?.lat])

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-base-300 shadow-xl shadow-base-content/5 md:h-[560px]">
      <Map
        ref={mapRef as never}
        initialViewState={initial}
        onLoad={handleLoad}
        onClick={(e) => {
          const { lng, lat } = (e as { lngLat: { lng: number; lat: number } }).lngLat
          reverseGeocode(accessToken, lng, lat).then((rev) => {
            onVenueSelect({
              name: rev?.name ?? 'Selected location',
              address: rev?.address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              lat,
              lng,
            })
          })
        }}
        mapboxAccessToken={accessToken}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
      >
        {venue && (
          <Marker longitude={venue.lng} latitude={venue.lat} draggable anchor="bottom" onDragEnd={(e) => {
            const { lng, lat } = e.lngLat
            onVenueSelect({ ...(venue ?? { name: 'Selected location', address: '' }), lng, lat })
          }}>
            <div className="host-pin">
              <div className="host-pin-pulse flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-primary text-base shadow-xl">☕</div>
            </div>
          </Marker>
        )}
      </Map>

      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} className={CONTROL_CLS} aria-label="Zoom in"><Plus className="h-5 w-5" /></button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} className={CONTROL_CLS} aria-label="Zoom out"><Minus className="h-5 w-5" /></button>
        <button
          type="button"
          onClick={async () => {
            const geo = await tryGeolocation()
            if (geo) flyTo(geo.lng, geo.lat, 14)
          }}
          className={CONTROL_CLS}
          aria-label={host_locate_me({}, { locale })}
          title={host_locate_me({}, { locale })}
        >
          <Crosshair className="h-5 w-5" />
        </button>
      </div>

      {venue && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 md:right-auto md:left-4 md:max-w-xs">
          <div className="rounded-2xl border border-base-300/60 bg-base-100/85 p-3 shadow-xl backdrop-blur-md">
            <p className="text-xs font-medium text-base-content/50">{host_selected_location({}, { locale })}</p>
            <p className="mt-0.5 line-clamp-1 text-sm font-bold text-base-content">{venue.name}</p>
            <p className="line-clamp-1 text-xs text-base-content/60">{venue.address}</p>
          </div>
        </div>
      )}
    </div>
  )
}
