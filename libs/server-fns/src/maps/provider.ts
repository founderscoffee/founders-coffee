import type { Result, VenueKind } from '@founders-coffee/core';
import type { geo } from '@founders-coffee/domain';

import type { MapLocale } from './types.js';

export interface MapProviderLocation {
  readonly marketCode: string;
  readonly city?: geo.GeoCity;
  readonly locale: MapLocale;
  readonly proximity?: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

export interface MapProvider extends MapProviderLocationOperations {
  readonly name: string;
}

export interface StoredPlace {
  readonly address: string;
  readonly admin?: VenueAdmin;
}

export interface MapProviderLocationOperations {
  describePoint: (input: {
    readonly marketCode: string;
    readonly locale: MapLocale;
    readonly latitude: number;
    readonly longitude: number;
  }) => Promise<Result<StoredPlace>>;
  getCityViewport: (
    input: MapProviderLocation,
  ) => Promise<Result<HostMapContext>>;
  searchVenues: (
    input: MapProviderLocation & { readonly query: string },
  ) => Promise<Result<readonly VenueCandidate[]>>;
  reverseVenue: (
    input: MapProviderLocation & {
      readonly latitude: number;
      readonly longitude: number;
    },
  ) => Promise<Result<VenueCandidate>>;
}

export interface HostMapContext {
  readonly center: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly bounds: readonly [number, number, number, number];
}

export type { VenueKind } from '@founders-coffee/core';

export interface VenueAdmin {
  readonly isoRegionCode?: string;
  readonly regionName?: string;
  readonly placeName?: string;
}

export interface VenueCandidate {
  readonly providerId: string;
  readonly kind: VenueKind;
  readonly name: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly admin?: VenueAdmin;
}
