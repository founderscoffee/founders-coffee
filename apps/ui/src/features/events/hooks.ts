import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import {
  eventsApi,
  type CreateEventInput,
  type HostMapContext,
  type HostMapLocationInput,
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

export const useCreateEvent = () =>
  useMutation({
    mutationFn: (input: CreateEventInput) => eventsApi.createEvent(input),
  });

export const useHostMapContext = (input: HostMapLocationInput) =>
  useQuery<HostMapContext>({
    queryKey: ['events', 'host-map', input],
    queryFn: () => eventsApi.getHostMapContext({ data: input }),
    staleTime: 30 * 60_000,
    retry: false,
  });

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
