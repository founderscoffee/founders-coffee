import type { EventWithAttendance } from '@founders-coffee/server-fns';

const HOUR = 60 * 60 * 1000;
const at = (offset: number) => new Date(Date.now() + offset);

export const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: 'algiers',
  title: 'Founders breakfast',
  description: 'A local founder meetup.',
  venue: 'Café Atlas',
  startsAt: at(24 * HOUR),
  endsAt: at(26 * HOUR),
  rsvps: 3,
  language: 'en',
  languages: ['en'],
  latitude: null,
  longitude: null,
  venueAddress: null,
  slug: 'founders-breakfast',
  status: 'published',
  version: 1,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  cancelledAt: null,
  cancellationReason: null,
  goingCount: 3,
  viewerRsvp: 'going',
} satisfies EventWithAttendance;

export const cancelled = {
  ...event,
  status: 'cancelled',
  cancelledAt: at(-10 * HOUR),
} satisfies EventWithAttendance;

export const inProgress = {
  ...event,
  startsAt: at(-HOUR),
  endsAt: at(HOUR),
} satisfies EventWithAttendance;

export const ended = {
  ...event,
  startsAt: at(-4 * HOUR),
  endsAt: at(-2 * HOUR),
} satisfies EventWithAttendance;

export const cancelledAndPast = {
  ...ended,
  status: 'cancelled',
  cancelledAt: at(-10 * HOUR),
} satisfies EventWithAttendance;

export const endless = {
  ...event,
  startsAt: at(-4 * HOUR),
  endsAt: null,
} satisfies EventWithAttendance;
