import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { eventsApi, type CreateEventInput, type RsvpInput } from './api';

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

export const useCreateRsvp = () =>
  useMutation({
    mutationFn: (input: RsvpInput) => eventsApi.createRsvp(input),
  });

export const useCancelRsvp = () =>
  useMutation({
    mutationFn: (input: RsvpInput) => eventsApi.cancelRsvp(input),
  });
