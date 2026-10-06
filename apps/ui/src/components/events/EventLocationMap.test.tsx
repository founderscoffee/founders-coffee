import { act, cleanup, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventLocationMap } from './EventLocationMap';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

const GOOGLE =
  'https://www.google.com/maps/dir/?api=1&destination=36.7538%2C3.0588';

const APPLE = 'https://maps.apple.com/?daddr=36.7538%2C3.0588';

const meetup = (mapboxToken: string | null) => (
  <EventLocationMap
    locale="ar"
    venue="مقهى الجزائر"
    latitude={36.7538}
    longitude={3.0588}
    mapboxToken={mapboxToken}
  />
);

const onDevice = (userAgent: string) =>
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);

const directions = () => screen.getByRole('link', { name: /^الاتجاهات/u });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the meetup page's map", () => {
  it("is Mapbox's picture of the place, one size for each height the page gives it", () => {
    const { container } = render(meetup('pk.test'));

    expect(container.querySelector('picture img')?.getAttribute('src')).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/3.0588,36.7538,14.5/400x224@2x?attribution=false&logo=false&access_token=pk.test',
    );
    expect(
      container.querySelector('picture img')?.getAttribute('srcset'),
      'a screen of one pixel per point takes the smaller picture',
    ).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/3.0588,36.7538,14.5/400x224?attribution=false&logo=false&access_token=pk.test 1x, https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/3.0588,36.7538,14.5/400x224@2x?attribution=false&logo=false&access_token=pk.test 2x',
    );
    expect(
      [...container.querySelectorAll('source')].map((source) =>
        source.getAttribute('media'),
      ),
    ).toEqual([
      '(min-width: 64rem)',
      '(min-width: 48rem)',
      '(min-width: 40rem)',
      '(min-width: 27rem)',
    ]);
  });

  it('asks for its picture first, the largest thing on the first screen of the page', () => {
    const { container } = render(meetup('pk.test'));

    expect(
      container.querySelector('picture img')?.getAttribute('fetchpriority'),
    ).toBe('high');
  });

  it('asks for pictures exactly as tall as the box it draws on each screen', () => {
    const { container } = render(meetup('pk.test'));
    const classes = container.querySelector('a')?.className.split(' ') ?? [];
    const screens = ['', 'sm:', 'md:', 'lg:'];
    const boxHeight = (screen: string) =>
      screens
        .slice(0, screens.indexOf(screen) + 1)
        .flatMap((prefix) =>
          classes
            .filter((name) => new RegExp(`^${prefix}h-\\d+$`, 'u').test(name))
            .map((name) => Number(name.slice(prefix.length + 2)) * 4),
        )
        .at(-1);
    const pictureHeight = (url: string | null | undefined) =>
      Number(/\/\d+x(\d+)(?:@2x)?\?/u.exec(url ?? '')?.[1]);

    expect(
      [...container.querySelectorAll('source')].map((source) =>
        pictureHeight(source.getAttribute('srcset')),
      ),
      'a picture shorter or taller than its box is scaled, and the map is no longer at the zoom it asked for',
    ).toEqual([
      boxHeight('lg:'),
      boxHeight('md:'),
      boxHeight('sm:'),
      boxHeight(''),
    ]);
    expect(
      pictureHeight(
        container.querySelector('picture img')?.getAttribute('src'),
      ),
    ).toBe(boxHeight(''));
  });

  it('shows the pin alone where there is no token, and still gives directions', () => {
    onDevice(ANDROID);
    const { container } = render(meetup(null));

    expect(
      container.querySelector('img'),
      'with no token there is no picture to ask Mapbox for, and no logo to draw on it',
    ).toBeNull();
    expect(screen.getAllByRole('link'), 'nor any credits to give').toEqual([
      directions(),
    ]);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(directions().getAttribute('href')).toBe(GOOGLE);
  });

  it("draws Mapbox's logo on the picture, inside the box the page crops to", () => {
    const { container } = render(meetup('pk.test'));
    const logo = [...directions().querySelectorAll('img')].find(
      (image) => image.closest('picture') === null,
    );

    expect(logo?.getAttribute('alt')).toBe('');
    expect(logo?.getAttribute('width')).toBe('88');
    expect(logo?.getAttribute('height')).toBe('23');
    expect(container.querySelectorAll('picture img')).toHaveLength(1);
  });

  it('credits Mapbox, OpenStreetMap and Maxar below the picture, and asks for corrections', () => {
    render(meetup('pk.test'));
    const credits = screen
      .getAllByRole('link')
      .filter((link) => link !== directions());

    expect(
      credits.map((link) => [
        link.textContent,
        link.getAttribute('href'),
        link.getAttribute('dir'),
      ]),
    ).toEqual([
      ['© Mapbox', 'https://www.mapbox.com/about/maps', 'ltr'],
      ['© OpenStreetMap', 'https://www.openstreetmap.org/copyright', 'ltr'],
      ['© Maxar', 'https://www.maxar.com/', 'ltr'],
      ['حسّن هذه الخريطة', 'https://apps.mapbox.com/feedback/', null],
    ]);
    expect(
      credits.filter((link) => directions().contains(link)),
      'a link inside the directions link would not be a link of its own',
    ).toEqual([]);
    expect(credits.map((link) => link.getAttribute('target'))).toEqual([
      '_blank',
      '_blank',
      '_blank',
      '_blank',
    ]);
  });

  it('opens directions in Google Maps away from Apple devices, in a tab of its own', () => {
    onDevice(ANDROID);
    render(meetup('pk.test'));

    expect(directions().getAttribute('href')).toBe(GOOGLE);
    expect(directions().getAttribute('target')).toBe('_blank');
    expect(directions().getAttribute('rel')).toBe('noopener noreferrer');
    expect(directions().getAttribute('aria-label')).toBe(
      'الاتجاهات إلى مقهى الجزائر في خرائط Google',
    );
  });

  it('opens directions in Apple Maps on an iPhone', () => {
    onDevice(IPHONE);
    render(meetup('pk.test'));

    expect(directions().getAttribute('href')).toBe(APPLE);
    expect(directions().getAttribute('aria-label')).toBe(
      'الاتجاهات إلى مقهى الجزائر في خرائط Apple',
    );
  });

  it('says on the map that it gives directions', () => {
    render(meetup(null));

    expect(directions().textContent).toBe('الاتجاهات');
  });

  it('pins the directions chip to its corner from a wrapper, which a touch screen leaves alone', () => {
    const { container } = render(meetup(null));
    const chip = container.querySelector('.btn');

    expect(
      chip?.classList.contains('absolute'),
      'under pointer: coarse, libs/ui/src/styles.css makes every .btn relative, and that beats .absolute',
    ).toBe(false);
    expect(chip?.parentElement?.classList).toContain('absolute');
    expect(chip?.parentElement?.classList).toContain('end-3');
  });

  it('renders Google Maps on the server, which cannot know the device, and moves an iPhone to Apple Maps once the page hydrates', async () => {
    onDevice(IPHONE);
    const html = renderToString(meetup('pk.test'));
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const reported = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(html).toContain(
      'href="https://www.google.com/maps/dir/?api=1&amp;destination=36.7538%2C3.0588"',
    );

    const root = await act(async () =>
      hydrateRoot(container, meetup('pk.test')),
    );

    expect(container.querySelector('a')?.getAttribute('href')).toBe(APPLE);
    expect(
      reported,
      'React reports a page whose first client render differs from the server through console.error',
    ).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
