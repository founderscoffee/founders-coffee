import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import type { EventDetailItem } from '@founders-coffee/server-fns';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
  }) =>
    createElement(
      'a',
      {
        href: Object.entries(params ?? {}).reduce(
          (path, [name, value]) => path.replace(`$${name}`, value),
          to ?? '/',
        ),
      },
      children,
    ),
}));

vi.mock('./RsvpSection', () => ({
  RsvpSection: () => null,
}));

vi.mock('./EventLocationMap', () => ({
  EventLocationMap: () => null,
}));

export const market = {
  code: 'DZ',
  name: 'Algeria',
  nameAr: 'الجزائر',
  nameFr: 'Algérie',
  slug: 'algeria',
  defaultLocale: 'ar',
  defaultCurrency: 'DZD',
  timezone: 'Africa/Algiers',
  direction: 'rtl',
  state: 'active',
  featureFlags: {
    events: true,
    hackathons: false,
    payments: false,
    recruiting: false,
  },
  brandOverrides: null,
  createdAt: 1_767_225_600,
} satisfies Market;

export const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: 'algiers',
  title: 'Founders breakfast',
  description: 'A local founder meetup.',
  venue: 'Café Atlas',
  startsAt: new Date('2026-09-20T10:00:00Z'),
  endsAt: new Date('2026-09-20T12:00:00Z'),
  rsvps: 0,
  language: 'en',
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
  goingCount: 0,
  viewerRsvp: null,
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  cityNameFr: 'Alger',
  citySlug: 'algiers',
} satisfies EventDetailItem;
