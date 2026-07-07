import mapboxgl from 'mapbox-gl'
import { Map } from 'react-map-gl/mapbox'

import { host_venue_ph, type Locale } from '@founders-coffee/i18n'
import { useEffect, useRef, useState } from 'react'

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

const createCoffeeMarker = (): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M10 2v2M14 2v2M16 8a1 1 0 0-1 1H9a1 1 0 0-1-1V5a1 1 0 0 1 1-1h0a1 1 0 0 1 1v0z" transform="translate(2 2)"/><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>'
  el.style.cssText = 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--color-primary);color:var(--color-primary-content);box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;'
  return el
}

interface SearchResult {
  name: string
  address: string
  lat: number
  lng: number
}

export const MapPicker = ({
  country,
  token,
  locale,
  onSelect,
}: {
  country: string
  token: string
  locale: Locale
  onSelect: (venue: VenueSelection) => void
}) => {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<VenueSelection | null>(null)
  const [showResults, setShowResults] = useState(false)

  const center = COUNTRY_CENTERS[country] ?? COUNTRY_CENTERS.DZ

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 1500,
        })
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 5000 },
    )
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) return
    try {
      const res = await fetch(
        `https://api.mapbox.com/search/search/v1?q=${encodeURIComponent(query)}&language=ar,fr,en&limit=5&access_token=${token}`,
      )
      const data: { features?: Array<{ name?: string; place_name?: string; geometry?: { coordinates?: [number, number] }; properties?: { name?: string; address?: string } }> } = await res.json()
      if (data.features) {
        setResults(
          data.features.map((f: { name?: string; place_name?: string; geometry?: { coordinates?: [number, number] }; properties?: { name?: string; address?: string } }) => ({
            name: f.name ?? f.properties?.name ?? 'Unknown',
            address: f.place_name ?? f.properties?.address ?? '',
            lat: f.geometry?.coordinates?.[1] ?? 0,
            lng: f.geometry?.coordinates?.[0] ?? 0,
          })),
        )
        setShowResults(true)
      }
    } catch {
      setResults([])
    }
  }

  const handleSelect = (venue: SearchResult) => {
    const selection: VenueSelection = { name: venue.name, address: venue.address, lat: venue.lat, lng: venue.lng }
    setSelected(selection)
    setShowResults(false)
    onSelect(selection)

    if (markerRef.current) markerRef.current.remove()
    markerRef.current = new mapboxgl.Marker({ element: createCoffeeMarker() })
      .setLngLat([venue.lng, venue.lat])
      .addTo(mapRef.current!)

    mapRef.current?.flyTo({ center: [venue.lng, venue.lat], zoom: 15, duration: 1000 })
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder={host_venue_ph({}, { locale })}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
        {showResults && results.length > 0 && (
          <ul className="dropdown-content z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="flex w-full flex-col px-4 py-2 text-start hover:bg-base-200"
                  onMouseDown={() => handleSelect(r)}
                >
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-base-content/50">{r.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-box border border-base-300">
        <Map
          ref={mapRef as never}
          initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 5 }}
          mapboxAccessToken={token}
          style={{ width: '100%', height: 300 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        />
      </div>

      {selected && (
        <div className="rounded-box bg-base-200 p-3 text-sm">
          <p className="font-semibold">{selected.name}</p>
          <p className="text-base-content/60">{selected.address}</p>
        </div>
      )}
    </div>
  )
}
