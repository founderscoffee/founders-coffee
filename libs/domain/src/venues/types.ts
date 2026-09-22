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

export { metresBetween } from '@founders-coffee/core';
