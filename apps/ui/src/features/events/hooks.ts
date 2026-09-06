import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { venues } from '@founders-coffee/domain';

import {
  createdEventQueryKeys,
  type CreatedEventKeys,
} from './created-event-cache';
import {
  eventsApi,
  type CancelEventInput,
  type CreatedEvent,
  type CreateEventInput,
  type HostMapContext,
  type HostMapLocationInput,
  type NearbyVenuesInput,
  type RsvpInput,
  type VenueCandidate,
  type VenueReverseInput,
  type VenueSearchInput,
} from './api';

type UpcomingEventsParams = Parameters<typeof eventsApi.getUpcomingEvents>[0];

export const useUpcomingEvents = (params: UpcomingEventsParams) =>
  useInfiniteQuery({
    queryKey: ['events', 'upcoming', params],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam as { startsAt: number; id: string } | undefined;
      return eventsApi.getUpcomingEvents({
        data: {
          ...params,
          afterStartsAt: cursor?.startsAt,
          afterId: cursor?.id,
        },
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as { startsAt: number; id: string } | undefined,
  });

export const useEvent = (slug: string) =>
  useQuery({
    queryKey: ['event', slug],
    queryFn: () => eventsApi.getEvent({ data: { slug } }),
  });

/**
 * Create an event, typed by the server function's real return.
 *
 * The `createServerFn` client surface erases its handler's return to `any`, so the mutation would
 * otherwise infer `unknown` and every caller would cast. `createEvent` resolves the persisted row,
 * and EC-08 reads the canonical route and cache keys straight off it, so the contract is stated
 * here once instead of at each use.
 */
export const useCreateEvent = () =>
  useMutation<CreatedEvent, Error, CreateEventInput>({
    mutationFn: (input) => eventsApi.createEvent(input),
  });

/** Refresh every cached view that now has to show the newly created event (EC-08). */
export const useInvalidateCreatedEvent = () => {
  const queryClient = useQueryClient();
  return (event: CreatedEventKeys) =>
    Promise.all(
      createdEventQueryKeys(event).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
};

export const useHostMapContext = (input: HostMapLocationInput) =>
  useQuery<HostMapContext>({
    queryKey: ['events', 'host-map', input],
    queryFn: () => eventsApi.getHostMapContext({ data: input }),
    staleTime: 30 * 60_000,
    retry: false,
  });

const GRID = 1_000;

/**
 * Venues near a point, cached per grid cell rather than per coordinate.
 *
 * The map reports a new centre on every pan, and a raw float would miss the cache every time. Three
 * decimals is roughly a hundred metres, which is far finer than the list's own radius.
 */
export const useNearbyVenues = (input: NearbyVenuesInput) => {
  const cell = [
    Math.round(input.latitude * GRID),
    Math.round(input.longitude * GRID),
  ];
  return useQuery<readonly venues.SnapshotVenue[]>({
    queryKey: ['events', 'nearby-venues', input.marketCode, ...cell],
    queryFn: () => eventsApi.listNearbyVenues({ data: input }),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
};

export const useVenueSearch = (input: VenueSearchInput) =>
  useQuery<readonly VenueCandidate[]>({
    queryKey: ['events', 'venue-search', input],
    queryFn: () => eventsApi.searchEventVenues({ data: input }),
    enabled: input.query.trim().length >= 2,
    staleTime: 60_000,
    retry: false,
  });

export const useReverseEventVenue = () =>
  useMutation<VenueCandidate, Error, VenueReverseInput>({
    mutationFn: (input: VenueReverseInput) =>
      eventsApi.reverseEventVenue({ data: input }),
  });

export const useCreateRsvp = () =>
  useMutation({
    mutationFn: (input: RsvpInput) => eventsApi.createRsvp(input),
  });

export const useCancelRsvp = () =>
  useMutation({
    mutationFn: (input: RsvpInput) => eventsApi.cancelRsvp(input),
  });

export const useCancelEvent = () =>
  useMutation({
    mutationFn: (input: CancelEventInput) => eventsApi.cancelEvent(input),
  });
