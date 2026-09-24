import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventLocationMap } from './EventLocationMap';

type MockMapProps = { children?: ReactNode; onLoad?: () => void };

const token = vi.hoisted(() => ({ data: 'pk.test' as string | undefined }));

vi.mock('../../features/events/hooks', () => ({
  useMapboxToken: () => token,
}));

vi.mock('react-map-gl/mapbox', () => ({
  Map: ({ children, onLoad }: MockMapProps) => (
    <div data-testid="map-surface">
      <button
        type="button"
        data-testid="map-loaded"
        onClick={() => onLoad?.()}
      />
      {children}
    </div>
  ),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const show = () =>
  render(
    <EventLocationMap
      locale="ar"
      venue="مقهى الجزائر"
      latitude={36.7538}
      longitude={3.0588}
    />,
  );

const skeleton = () =>
  screen
    .queryAllByRole('status')
    .find((region) => region.textContent === 'جارٍ تحميل الخريطة…') ?? null;

afterEach(() => {
  cleanup();
  token.data = 'pk.test';
});

describe('what the event page shows while its map is loading', () => {
  it('covers the map with a skeleton until the tiles arrive', () => {
    show();

    expect(
      skeleton(),
      'the map sits on a bg-base-200 box, so until Mapbox paints there is a flat beige rectangle the reader cannot tell from a map that failed',
    ).not.toBeNull();
  });

  it('takes the skeleton away once the map says it has loaded', () => {
    show();

    fireEvent.click(screen.getByTestId('map-loaded'));

    expect(skeleton()).toBeNull();
    expect(screen.getByTestId('map-surface')).toBeTruthy();
  });

  it('shows a pin rather than a skeleton when there is no map to wait for', () => {
    token.data = undefined;
    show();

    expect(
      skeleton(),
      'without a token no map is coming, so a skeleton would promise one forever',
    ).toBeNull();
    expect(screen.queryByTestId('map-surface')).toBeNull();
  });
});
