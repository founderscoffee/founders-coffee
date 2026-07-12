import { DZ_CITIES, DZ_STATES } from './data/dz.js'
import { EG_CITIES, EG_STATES } from './data/eg.js'
import { SA_CITIES, SA_STATES } from './data/sa.js'
import type { CitySearchResult, GeoCity, GeoState } from './types.js'

/**
 * Geographic data (server-side TS files — NOT bundled in the client). Full datasets for DZ (58
 * wilayas + 1,541 communes), EG (27 governorates + 396 cities), SA (13 regions + 4,581 cities).
 * Queried via server-fns (RPC stubs) from the UI. Normalized to universal "state" + "city".
 */

const STATES: Readonly<Record<string, readonly GeoState[]>> = {
  DZ: DZ_STATES,
  EG: EG_STATES,
  SA: SA_STATES,
}

const CITIES: Readonly<Record<string, readonly GeoCity[]>> = {
  DZ: DZ_CITIES,
  EG: EG_CITIES,
  SA: SA_CITIES,
}

/** All states for a country (DZ/EG/SA). */
export const getStates = (country: string): readonly GeoState[] => STATES[country] ?? []

/** All cities within a state. */
export const getCities = (country: string, stateCode: string): readonly GeoCity[] =>
  (CITIES[country] ?? []).filter((c) => c.stateCode === stateCode)

/** Featured cities (state capitals / major cities) for a country — drives the landing page. */
export const getFeaturedCities = (country: string): readonly GeoCity[] =>
  (CITIES[country] ?? []).filter((c) => c.featured)

/** Find a city by its URL slug (for the city page /{market}/{city-slug}). */
export const findCityBySlug = (country: string, slug: string): GeoCity | undefined =>
  (CITIES[country] ?? []).find((c) => c.slug === slug)

/** Find a city by its code (for profile validation). */
export const findCity = (country: string, cityCode: string): GeoCity | undefined =>
  (CITIES[country] ?? []).find((c) => c.code === cityCode)

/** Find a state by its code. */
export const findState = (country: string, stateCode: string): GeoState | undefined =>
  (STATES[country] ?? []).find((s) => s.code === stateCode)

/**
 * Search a country's cities by free-text query, matching the city name (LTR `name` or `nameAr`) OR
 * the parent state name. Returns up to `limit` results ranked: city-name hits first (more specific),
 * then featured (capitals), then alphabetical. Each result carries the parent state so the UI can
 * show "City, State" for disambiguation (city names repeat across states). Used by the hero
 * typeahead — the full dataset (thousands of cities) stays server-side; only matches are returned.
 */
export const searchLocations = (
  country: string,
  query: string,
  limit = 20,
): readonly CitySearchResult[] => {
  const q = query.trim()
  if (!q) return []
  const qLower = q.toLowerCase()
  const stateByCode = new Map((STATES[country] ?? []).map((s) => [s.code, s]))

  const scored: { city: GeoCity; state: GeoState; rank: number }[] = []
  for (const city of CITIES[country] ?? []) {
    const state = stateByCode.get(city.stateCode)
    if (!state) continue
    const cityHit = city.name.toLowerCase().includes(qLower) || city.nameAr.includes(q)
    const stateHit = state.name.toLowerCase().includes(qLower) || state.nameAr.includes(q)
    if (cityHit || stateHit) {
      scored.push({ city, state, rank: cityHit ? 0 : 1 })
    }
  }
  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.city.featured) - Number(a.city.featured) ||
      a.city.name.localeCompare(b.city.name),
  )
  return scored.slice(0, limit).map(({ city, state }) => ({ city, state }))
}

export type { CitySearchResult, GeoCity, GeoState } from './types.js'
