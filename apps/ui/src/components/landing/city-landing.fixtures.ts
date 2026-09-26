import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

export const market: Market = {
  code: 'DZ',
  name: 'Algeria',
  nameAr: 'الجزائر',
  nameFr: 'Algérie',
  slug: 'algeria',
  defaultLocale: 'ar',
  defaultCurrency: 'DZD',
  timezone: 'Africa/Algiers',
  direction: 'rtl',
  state: 'active',
  brandOverrides: null,
  createdAt: 0,
  featureFlags: {
    events: true,
    hackathons: false,
    payments: false,
    recruiting: false,
  },
};

export const oran: geo.GeoCity = {
  code: '1131',
  name: 'Oran',
  nameAr: 'وهران',
  slug: 'oran',
  stateCode: '31',
  featured: true,
};

export const oranByLocale: Record<Locale, string> = {
  ar: 'وهران',
  fr: 'Oran',
  en: 'Oran',
};

/** An upcoming Oran meetup on a Friday in 2099, in English unless told otherwise. */
export const meetup = (
  overrides: Partial<EventFeedItem> = {},
): EventFeedItem => ({
  id: 'evt_city_landing',
  hostId: 'usr_host',
  marketCode: 'DZ',
  stateCode: '31',
  cityCode: '1131',
  title: 'Founder coffee',
  description: 'A short founder conversation over coffee.',
  venue: 'Coffee shop',
  slug: 'founder-coffee',
  startsAt: new Date('2099-09-18T14:00:00Z'),
  endsAt: null,
  language: 'en',
  rsvps: 2,
  latitude: null,
  longitude: null,
  venueAddress: null,
  status: 'published',
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  cancelledAt: null,
  cancellationReason: null,
  cityName: 'Oran',
  cityNameAr: 'وهران',
  cityNameFr: 'Oran',
  citySlug: 'oran',
  goingCount: 2,
  hostName: 'Host Name',
  hostPhotoAssetId: null,
  ...overrides,
});
