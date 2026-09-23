import { geo, profile } from '@founders-coffee/domain';
import type { Event, PublicEventHost } from '@founders-coffee/db';

import type { EventAttendance } from './attendance.js';

export type EventFeedItemBase = Event & {
  readonly cityName: string;
  readonly cityNameAr: string;
  readonly cityNameFr: string;
  readonly citySlug: string | null;
  readonly hostName: string | null;
  readonly hostPhotoAssetId: string | null;
};

export type EventFeedItem = EventFeedItemBase & Partial<EventAttendance>;

export const attachCityNames = (
  rows: readonly Event[],
  hosts = new Map<string, PublicEventHost>(),
): EventFeedItemBase[] =>
  rows.map((event) => {
    const city = geo.findCity(event.marketCode, event.cityCode);
    const host = hosts.get(event.hostId);
    return {
      ...event,
      cityName: city?.name ?? event.cityCode,
      cityNameAr: city?.nameAr ?? city?.name ?? event.cityCode,
      cityNameFr: city?.nameFr ?? city?.name ?? event.cityCode,
      citySlug: city?.slug ?? null,
      hostName: host ? profile.safeProfileDisplayName(host.name) || null : null,
      hostPhotoAssetId: host?.photoAssetId ?? null,
    };
  });
