import { useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_venue_rate_limited,
  host_venue_search_error,
  type Locale,
} from '@founders-coffee/i18n';

import type { VenueStepNotice } from './VenueStepToasts';

type VenueLookup = {
  readonly error: unknown;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly errorUpdatedAt: number;
  readonly refetch: () => unknown;
};

export type VenueError = {
  readonly message: string;
  readonly onDismiss: () => void;
};

/**
 * The venue step's failures, as toasts the host can retry or put away.
 *
 * A failed lookup stays up until the host retries it, dismisses it or searches for something else:
 * it carries the retry, and a toast that timed out would take the retry away with it. A dismissal
 * is remembered against the failure it closed rather than for good, so the next failure shows.
 * While a retry is in flight the toast steps aside, which is how the host sees it was tried.
 */
export const useVenueNotices = ({
  locale,
  lookup,
  venueError,
}: {
  locale: Locale;
  lookup: VenueLookup;
  venueError?: VenueError;
}): readonly VenueStepNotice[] => {
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const failedAt =
    lookup.isError && !lookup.isFetching ? lookup.errorUpdatedAt : null;
  const lookupNotices: VenueStepNotice[] =
    failedAt !== null && failedAt !== dismissedAt
      ? [
          {
            id: `venue-lookup-${failedAt}`,
            message:
              appErrorCode(lookup.error) === 'rate_limited'
                ? host_venue_rate_limited({}, { locale })
                : host_venue_search_error({}, { locale }),
            onRetry: () => void lookup.refetch(),
            onDismiss: () => setDismissedAt(failedAt),
          },
        ]
      : [];
  return venueError
    ? [
        ...lookupNotices,
        {
          id: 'venue-required',
          message: venueError.message,
          onDismiss: venueError.onDismiss,
        },
      ]
    : lookupNotices;
};
