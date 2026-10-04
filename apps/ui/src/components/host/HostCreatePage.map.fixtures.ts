import { createElement } from 'react';
import { vi } from 'vitest';

vi.mock('./HostMap', () => ({
  HostMap: ({
    isInteractive = true,
    onVenueSelect,
    onUserMove,
    onUserGestureEnd,
    onSearch,
    onMiss,
  }: {
    isInteractive?: boolean;
    onVenueSelect: (venue: {
      providerId: string;
      kind: 'poi' | 'address';
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    }) => void;
    onUserMove?: () => void;
    onUserGestureEnd?: () => void;
    onSearch?: () => void;
    onMiss?: () => void;
  }) => {
    const tapAt = (venue: Parameters<typeof onVenueSelect>[0]) => () => {
      onUserGestureEnd?.();
      onVenueSelect(venue);
    };
    return createElement(
      'div',
      { 'data-testid': 'host-map', 'data-interactive': String(isInteractive) },
      [
        createElement(
          'button',
          {
            key: 'poi',
            onClick: tapAt({
              providerId: 'poi-cafe',
              kind: 'poi' as const,
              name: 'Founders Café',
              address: '12 Startup Street, Algiers',
              latitude: 36.7538,
              longitude: 3.0588,
            }),
          },
          'Choose venue',
        ),
        createElement(
          'button',
          {
            key: 'address',
            onClick: tapAt({
              providerId: 'address-yousfi',
              kind: 'address' as const,
              name: '15 Rue Yousfi Mohamed',
              address: '15 Rue Yousfi Mohamed, Alger',
              latitude: 36.7501,
              longitude: 3.0601,
            }),
          },
          'Choose address',
        ),
        createElement(
          'button',
          { key: 'move', onClick: () => onUserMove?.() },
          'Move the map',
        ),
        createElement(
          'button',
          { key: 'release', onClick: () => onUserGestureEnd?.() },
          'Let go of the map',
        ),
        onSearch &&
          createElement(
            'button',
            { key: 'search', onClick: onSearch },
            'Search',
          ),
        onMiss &&
          createElement(
            'button',
            { key: 'miss', onClick: onMiss },
            'Tap where the map has nothing',
          ),
      ],
    );
  },
}));
