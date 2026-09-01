export interface GeoState {
  readonly code: string;
  readonly name: string;
  readonly nameAr: string;
}

export interface GeoCity {
  readonly code: string;
  readonly name: string;
  readonly nameAr: string;
  readonly slug: string;
  readonly stateCode: string;
  readonly featured: boolean;
}

export interface CitySearchResult {
  readonly city: GeoCity;
  readonly state: GeoState;
}
