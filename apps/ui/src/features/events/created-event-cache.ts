export interface CreatedEventKeys {
  readonly marketCode: string;
  readonly cityCode: string;
  readonly hostId: string;
  readonly slug: string;
}

/**
 * The cached views a newly created event changes (EC-08).
 *
 * A published event joins the market landing feed, its city feed, its own detail view, and the
 * host's public profile, so leaving those cached shows the host a site that does not yet contain
 * the event they just created. The upcoming-events key is a prefix because that feed is queried
 * under many parameter combinations; the map-context and venue-search keys under the same `events`
 * root are deliberately NOT matched, since refetching them spends billed Mapbox requests to no
 * effect.
 *
 * Kept out of the hook module so the key set can be asserted against a real `QueryClient` — that
 * module reaches `api.ts`, and importing it drags the whole server-function graph into the test.
 */
export const createdEventQueryKeys = (
  event: CreatedEventKeys,
): readonly (readonly unknown[])[] => [
  ['events', 'upcoming'],
  ['event', event.slug],
  ['markets', 'landing', event.marketCode],
  ['markets', 'city', event.marketCode, event.cityCode],
  ['profile', 'public', event.hostId],
];
