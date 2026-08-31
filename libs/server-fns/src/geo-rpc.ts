import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { geo } from '@founders-coffee/domain';

/**
 * Geographic data RPCs — delegate to the domain geo functions (server-side TS data files). The data
 * (6,518 cities across DZ/EG/SA) stays server-side; the client gets only the filtered subsets it
 * requests. Used by the onboarding cascading picker + the profile editor.
 */
export const getStates = createServerFn({ strict: false })
  .validator(z.object({ country: z.string() }))
  .handler(async ({ data }) => geo.getStates(data.country));

export const getCities = createServerFn({ strict: false })
  .validator(z.object({ country: z.string(), state: z.string() }))
  .handler(async ({ data }) => geo.getCities(data.country, data.state));

/** Single-city lookup by code (host/create resolves ?city → GeoCity, yielding stateCode for the payload). */
export const getCity = createServerFn({ strict: false })
  .validator(z.object({ country: z.string(), cityCode: z.string() }))
  .handler(async ({ data }) => geo.findCity(data.country, data.cityCode));

export const getFeaturedCities = createServerFn({ strict: false })
  .validator(z.object({ country: z.string() }))
  .handler(async ({ data }) => geo.getFeaturedCities(data.country));

/** Free-text city search (hero typeahead) — matches city OR state name; returns up to `limit`. */
export const searchCities = createServerFn({ strict: false })
  .validator(
    z.object({
      marketCode: z.string(),
      query: z.string(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  )
  .handler(async ({ data }) =>
    geo.searchLocations(data.marketCode, data.query, data.limit),
  );
