import type { EventCityNames } from './event-city-name';
import type { EventRegionNames } from './event-region-name';

const comparable = (name: string): string => name.trim().toLowerCase();

/**
 * The street address to publish for a meetup, or null when the stored one names no street.
 *
 * Where the map provider knows a café only by its city, the address it verified is the city's name
 * and nothing more. Published as a street address, that is the "Sydney" Google's event guidelines
 * give as the address not to use, and it repeats the locality printed beside it. Any name the city
 * or its region goes by, in any of the site's languages, counts.
 */
export const eventStreetAddress = (
  event: EventCityNames &
    EventRegionNames & { readonly venueAddress: string | null },
): string | null => {
  if (event.venueAddress === null) return null;
  const placeNames = [
    event.cityName,
    event.cityNameAr,
    event.cityNameFr,
    event.stateName,
    event.stateNameAr,
    event.stateNameFr,
  ].flatMap((name) => (name === null ? [] : [comparable(name)]));
  return placeNames.includes(comparable(event.venueAddress))
    ? null
    : event.venueAddress;
};
