import type { Result } from '@founders-coffee/core';
import type { geo } from '@founders-coffee/domain';

import type { MapLocale } from './types.js';

export interface MapProviderLocation {
  readonly marketCode: string;
  readonly city: geo.GeoCity;
  readonly locale: MapLocale;
}

export interface MapProvider extends MapProviderLocationOperations {
  readonly name: string;
}

export interface MapProviderLocationOperations {
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

export interface VenueCandidate {
  readonly providerId: string;
  readonly name: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
}
