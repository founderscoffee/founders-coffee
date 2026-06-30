import { DZ_CITIES, DZ_STATES } from './data/dz.js'
import { EG_CITIES, EG_STATES } from './data/eg.js'
import { SA_CITIES, SA_STATES } from './data/sa.js'
import type { GeoCity, GeoState } from './types.js'

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

export type { GeoCity, GeoState } from './types.js'
