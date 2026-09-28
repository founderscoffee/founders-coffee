import type { VenueSelection } from './types';

/**
 * The address to print under a venue's name, or nothing when it would only repeat the name.
 *
 * Mapbox names a street address by its whole address in Arabic, so for those picks the name and
 * the address are the same text, and the venue list and the card over the pin printed it twice.
 */
export const venueAddressLine = (
  venue: Pick<VenueSelection, 'name' | 'address'>,
): string => (venue.address.trim() === venue.name.trim() ? '' : venue.address);
