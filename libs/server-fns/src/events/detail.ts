import { geo } from '@founders-coffee/domain';
import type { Db, Event } from '@founders-coffee/db';

import { attachAttendance, type EventDetailItem } from './attendance.js';

/**
 * A resolved meetup as its page shows it: how many are going, whether the reader is one of them,
 * and its city and state named in each of the page's languages. The names come from the geo data
 * here on the server, which is never bundled to the client.
 */
export const eventDetail = async (
  db: Db,
  event: Event,
  viewerId?: string | null,
): Promise<EventDetailItem> => {
  const [enriched] = await attachAttendance(db, [event], viewerId);
  const city = geo.findCity(event.marketCode, event.cityCode);
  const state = geo.findState(event.marketCode, event.stateCode);
  return {
    ...enriched,
    cityName: city?.name ?? event.cityCode,
    cityNameAr: city?.nameAr ?? city?.name ?? event.cityCode,
    cityNameFr: city?.nameFr ?? city?.name ?? event.cityCode,
    citySlug: city?.slug ?? null,
    stateName: state?.name ?? null,
    stateNameAr: state?.nameAr ?? state?.name ?? null,
    stateNameFr: state?.nameFr ?? state?.name ?? null,
  };
};
