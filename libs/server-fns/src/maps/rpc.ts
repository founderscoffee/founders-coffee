import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';

import type { HostMapContext, VenueCandidate } from './provider.js';
import {
  getHostMapContextResolver,
  reverseEventVenueResolver,
  searchEventVenuesResolver,
} from './resolver.js';
import { getMapProvider } from './runtime.js';
import {
  hostMapContextSchema,
  venueReverseSchema,
  venueSearchSchema,
} from './schemas.js';

export const getHostMapContext = createServerFn({ strict: false })
  .validator(appValidator(hostMapContextSchema))
  .handler(async ({ data }): Promise<HostMapContext> =>
    handleResult(getHostMapContextResolver(getMapProvider(), data)),
  );

export const searchEventVenues = createServerFn({ strict: false })
  .validator(appValidator(venueSearchSchema))
  .handler(async ({ data }): Promise<readonly VenueCandidate[]> =>
    handleResult(searchEventVenuesResolver(getMapProvider(), data)),
  );

export const reverseEventVenue = createServerFn({ strict: false })
  .validator(appValidator(venueReverseSchema))
  .handler(async ({ data }): Promise<VenueCandidate> =>
    handleResult(reverseEventVenueResolver(getMapProvider(), data)),
  );
