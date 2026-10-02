import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import type { EventFeedItem } from '@founders-coffee/server-fns';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => createElement('a', { href: '/', className }, children),
}));

export const event: EventFeedItem = {
  id: 'evt_card',
  hostId: 'usr_host',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '1',
  title: 'Founder coffee',
  description: 'A short founder conversation over coffee.',
  venue: 'Coffee shop',
  slug: 'founder-coffee',
  startsAt: new Date('2026-09-18T14:00:00Z'),
  endsAt: null,
  language: 'ar',
  languages: ['ar'],
  rsvps: 0,
  latitude: null,
  longitude: null,
  venueAddress: null,
  status: 'published',
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  cancelledAt: null,
  cancellationReason: null,
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  cityNameFr: 'Alger',
  citySlug: 'algiers',
  goingCount: 0,
  hostName: null,
  hostPhotoAssetId: null,
};
