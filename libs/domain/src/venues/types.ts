import { z } from 'zod';

import type { VenueKind } from '@founders-coffee/core';

export const VENUE_CATEGORIES = ['cafe', 'coworking', 'restaurant'] as const;
export const venueCategorySchema = z.enum(VENUE_CATEGORIES);
export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

export interface SnapshotVenue {
  readonly providerId: string;
  readonly kind: Extract<VenueKind, 'poi'>;
  readonly name: string;
  readonly nameLatin: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly category: VenueCategory;
  readonly eligible: boolean;
}

export interface CityVenueSnapshot {
  readonly market: string;
  readonly cityCode: string;
  readonly center: { readonly latitude: number; readonly longitude: number };
  readonly bounds: readonly [number, number, number, number];
  readonly venues: readonly SnapshotVenue[];
}

export const SNAPSHOT_PROVIDER_PREFIX = 'osm:';

/** Metres between two coordinates, for checking a submitted point against its snapshot record. */
export const metresBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
};
