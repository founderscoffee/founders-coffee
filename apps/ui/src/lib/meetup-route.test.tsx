import { isNotFound } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import {
  event as upcoming,
  inProgress,
} from '../components/events/HostEventPanel.fixtures';
import { market } from '../components/landing/city-landing.fixtures';

type Props = Record<string, unknown>;

const seen = vi.hoisted(() => ({
  detail: [] as Props[],
  dashboard: [] as Props[],
  live: [] as { enabled?: boolean }[],
  reloads: 0,
}));

const serverFns = vi.hoisted(() => ({
  getEventPage: vi.fn(),
  getMapboxToken: vi.fn(),
}));

vi.mock('@founders-coffee/server-fns', () => serverFns);

vi.mock('../components/events/EventDetail', () => ({
  EventDetail: (props: Props) => {
    seen.detail.push(props);
    return null;
  },
}));

vi.mock('../features/events/components/LiveDashboard', () => ({
  LiveDashboard: (props: Props) => {
    seen.dashboard.push(props);
    return null;
  },
}));

vi.mock('../features/events/useEventLive', () => ({
  useEventLive: (_eventId: string, options: { enabled?: boolean }) => {
    seen.live.push(options);
    return { notAttending: false };
  },
}));

vi.mock('./reload-on-member-change', () => ({
  useReloadOnMemberChange: () => {
    seen.reloads += 1;
  },
}));

const { Route } = await import('../routes/$locale.$market.e.$slug');

const HOST_ID = inProgress.hostId;

const detailOf = (base: typeof inProgress): EventDetailItem => ({
  ...base,
  viewerRsvp: null,
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  cityNameFr: 'Alger',
  citySlug: 'algiers',
  stateName: 'Algiers',
  stateNameAr: 'الجزائر',
  stateNameFr: 'Alger',
});

const serverRender = (viewerId: string | null, base = inProgress) => {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({
    locale: 'en',
    market,
    event: detailOf(base),
    host: null,
    viewerId,
    mapboxToken: 'pk.test',
  });
  const Page = Route.options.component;
  if (!Page) throw new Error('the meetup route lost its component');
  renderToString(<Page />);
  return {
    detail: seen.detail.at(-1),
    dashboard: seen.dashboard.at(-1),
    live: seen.live.at(-1),
  };
};

describe("the meetup page's reader, as the server renders it", () => {
  beforeEach(() => {
    seen.detail.length = 0;
    seen.dashboard.length = 0;
    seen.live.length = 0;
    seen.reloads = 0;
  });

  it.each([
    ['in its live hour', inProgress],
    ['before it starts', upcoming],
  ])(
    "renders the host's panel for the host reading their own meetup %s",
    (_when, base) => {
      const { detail } = serverRender(HOST_ID, base);

      expect(
        detail?.isHost,
        "the server renders the browser's session as still resolving, and the route took the host from it, so the host's own meetup went out with a guest's RSVP box until the session answered after hydration",
      ).toBe(true);
    },
  );

  it("opens the host's live room and its dashboard without waiting for the browser's session", () => {
    const { detail, live, dashboard } = serverRender(HOST_ID);

    expect(
      detail?.live,
      'without the room the panel says it opens an hour before the start',
    ).not.toBeNull();
    expect(live?.enabled).toBe(true);
    expect(dashboard?.currentUserId).toBe(HOST_ID);
  });

  it("renders a guest's box for a member who does not host the meetup", () => {
    const { detail, live, dashboard } = serverRender('usr_guest');

    expect(detail?.isHost).toBe(false);
    expect(live?.enabled).toBe(false);
    expect(dashboard).toBeUndefined();
  });

  it('renders a signed-out reader no host panel and no live room', () => {
    const { detail, live, dashboard } = serverRender(null);

    expect(detail?.isHost).toBe(false);
    expect(detail?.live).toBeNull();
    expect(live?.enabled).toBe(false);
    expect(dashboard).toBeUndefined();
  });

  it('loads the page again when its member changes', () => {
    serverRender(HOST_ID);

    expect(seen.reloads).toBeGreaterThan(0);
  });

  it('hands the page the Mapbox token its loader read, for the map picture', () => {
    const { detail } = serverRender(null);

    expect(detail?.mapboxToken).toBe('pk.test');
  });
});

const load = async () => {
  const loader = Route.options.loader;
  if (typeof loader !== 'function')
    throw new Error('the meetup route lost its loader');
  return loader({
    params: { locale: 'en', market: 'algeria', slug: upcoming.slug },
    context: { locale: 'en', markets: [market] },
  } as never);
};

describe("the meetup page's loader", () => {
  beforeEach(() => {
    serverFns.getEventPage.mockReset().mockResolvedValue({
      market,
      event: detailOf(upcoming),
      host: null,
      viewerId: null,
    } as never);
    serverFns.getMapboxToken.mockReset().mockResolvedValue('pk.test');
  });

  it('reads the Mapbox token beside the page, so the map picture is in the page the server sends', async () => {
    const data = await load();

    expect(data?.mapboxToken).toBe('pk.test');
    expect(serverFns.getMapboxToken).toHaveBeenCalledOnce();
  });

  it('serves the page without the picture when the token cannot be read', async () => {
    serverFns.getMapboxToken.mockRejectedValue(
      new AppError('env_missing', 'Missing required env var: MAPBOX_TOKEN'),
    );

    const data = await load();

    expect(
      data?.mapboxToken,
      'the token only draws the picture: the place, its pin and its directions need none',
    ).toBeNull();
    expect(data?.event.slug).toBe(upcoming.slug);
  });

  it('still answers a meetup its market does not have as a missing page', async () => {
    serverFns.getEventPage.mockRejectedValue(
      new AppError('event_not_found', 'Event not found'),
    );

    await expect(load()).rejects.toSatisfy(isNotFound);
  });
});
