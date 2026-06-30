/** A state/governorate/region within a country (wilaya · governorate · region). */
export interface GeoState {
  readonly code: string
  readonly name: string
  readonly nameAr: string
}

/** A city/commune/district within a state. `featured` = state capital / major city (drives the landing). */
export interface GeoCity {
  readonly code: string
  readonly name: string
  readonly nameAr: string
  readonly slug: string
  readonly stateCode: string
  readonly featured: boolean
}
