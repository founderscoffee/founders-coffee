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

export const getFeaturedCities = createServerFn({ strict: false })
  .validator(z.object({ country: z.string() }))
  .handler(async ({ data }) => geo.getFeaturedCities(data.country));
