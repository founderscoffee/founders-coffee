import { foldForSearch, metresBetween } from '@founders-coffee/core';
import { venues as venuesDomain } from '@founders-coffee/domain';

import type { VenueCandidate } from './provider.js';

const DUPLICATE_DISTANCE_METRES = 60;
const SNAPSHOT_RESULT_LIMIT = 8;

const rankOf = (
  folded: { name: string; nameLatin: string; address: string },
  query: string,
): number => {
  if (folded.name.startsWith(query)) return 0;
  if (folded.name.includes(query)) return 1;
  if (folded.nameLatin.includes(query)) return 2;
  return folded.address.includes(query) ? 3 : -1;
};

/**
 * The venues this market already ships, matching what the reader typed.
 *
 * Searched before the map provider rather than after it, because the provider indexes almost no
 * cafes in Algiers or Cairo under any name and none of them under an Arabic one. `matchSnapshotVenue`
 * already records that and refuses to re-verify a snapshot venue through the provider at publish
 * time; this is the same fact applied one step earlier, at the point the host is looking.
 *
 * Only eligible venues are offered, because publishing checks the same flag: a restaurant returned
 * here would be refused on the step after this one, which is a worse answer than not offering it.
 *
 * A name is worth more than an address, and the start of a name more than its middle, so the ranks
 * run in that order. Matching the address at all is safe here in a way it is not for the provider,
 * whose results reach across the country: a snapshot is a single city, so there is no wilaya for a
 * loose match to leak in from.
 */
export const searchSnapshotVenues = (
  marketCode: string,
  cityCode: string | undefined,
  query: string,
): readonly VenueCandidate[] => {
  const folded = foldForSearch(query);
  if (!cityCode || folded === '') return [];
  return venuesDomain
    .getCityVenues(marketCode, cityCode)
    .filter((venue) => venue.eligible)
    .map((venue) => ({
      venue,
      rank: rankOf(
        {
          name: foldForSearch(venue.name),
          nameLatin: foldForSearch(venue.nameLatin),
          address: foldForSearch(venue.address),
        },
        folded,
      ),
    }))
    .filter(({ rank }) => rank >= 0)
    .sort((left, right) => left.rank - right.rank)
    .slice(0, SNAPSHOT_RESULT_LIMIT)
    .map(({ venue }) => ({
      providerId: venue.providerId,
      kind: venue.kind,
      name: venue.name,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
    }));
};

/**
 * The provider's results, less the ones already answered from the snapshot.
 *
 * The two sources name the same cafe with different ids, so an id comparison finds no duplicates at
 * all and the reader is offered the same place twice. Folded name plus a short distance is what
 * actually identifies them: the names agree once spelling is folded away, and the coordinates agree
 * to within a building. Distance alone would merge two cafes on one street, and name alone would
 * merge every `مقهى` in the city.
 */
export const withoutSnapshotDuplicates = (
  known: readonly VenueCandidate[],
  found: readonly VenueCandidate[],
): readonly VenueCandidate[] =>
  found.filter(
    (candidate) =>
      !known.some(
        (venue) =>
          foldForSearch(venue.name) === foldForSearch(candidate.name) &&
          metresBetween(venue, candidate) <= DUPLICATE_DISTANCE_METRES,
      ),
  );
