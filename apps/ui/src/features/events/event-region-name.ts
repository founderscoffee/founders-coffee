import { localizedName, type Locale } from '@founders-coffee/i18n';

export type EventRegionNames = {
  readonly stateName: string | null;
  readonly stateNameAr: string | null;
  readonly stateNameFr: string | null;
};

/**
 * The name of an event's wilaya, governorate or region in the reader's language, or null when the
 * versioned dataset no longer knows its code.
 *
 * It is read the way `eventCityName` reads the city, the Latin name standing in where a region has
 * no name of its own in a language, so an event page names both the same way.
 */
export const eventRegionName = (
  event: EventRegionNames,
  locale: Locale,
): string | null =>
  event.stateName === null
    ? null
    : localizedName(
        {
          name: event.stateName,
          nameAr: event.stateNameAr ?? event.stateName,
          nameFr: event.stateNameFr ?? event.stateName,
        },
        locale,
      );
