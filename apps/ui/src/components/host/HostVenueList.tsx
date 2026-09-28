import { MapPin } from 'lucide-react';
import { useRef } from 'react';

import type { venues as venuesDomain } from '@founders-coffee/domain';
import {
  cat_venue_cafe,
  cat_venue_coworking,
  cat_venue_restaurant,
  host_osm_attribution,
  host_venue_address,
  host_venue_ineligible,
  host_venue_selected,
  type Locale,
} from '@founders-coffee/i18n';

import type { VenueSelection } from '../../features/events/types';
import { venueAddressLine } from '../../features/events/venue-address-line';

const CATEGORY_LABELS = {
  cafe: cat_venue_cafe,
  coworking: cat_venue_coworking,
  restaurant: cat_venue_restaurant,
} as const;

export type VenueRow = VenueSelection & {
  readonly category?: venuesDomain.VenueCategory;
  readonly eligible: boolean;
};

type HostVenueListProps = {
  locale: Locale;
  id: string;
  label: string;
  venues: readonly VenueRow[];
  selectedProviderId?: string;
  showAttribution: boolean;
  onSelect: (venue: VenueSelection) => void;
  onChoose?: () => void;
};

export const HostVenueList = ({
  locale,
  id,
  label,
  venues,
  selectedProviderId,
  showAttribution,
  onSelect,
  onChoose,
}: HostVenueListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectable = venues.filter((venue) => venue.eligible);
  const focusedId = selectable.some(
    (venue) => venue.providerId === selectedProviderId,
  )
    ? selectedProviderId
    : selectable[0]?.providerId;

  const choose = (venue: VenueSelection) => {
    onSelect(venue);
    onChoose?.();
  };

  const move = (from: string, delta: number) => {
    if (selectable.length === 0) return;
    const index = selectable.findIndex((venue) => venue.providerId === from);
    const next =
      selectable[(index + delta + selectable.length) % selectable.length];
    onSelect(next);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-venue="${next.providerId}"]`)
      ?.focus();
  };

  return (
    <div ref={listRef}>
      <div
        id={id}
        role="listbox"
        aria-label={label}
        className="flex flex-col gap-1"
      >
        {venues.map((venue) => {
          const checked = venue.providerId === selectedProviderId;
          const isAddress = venue.kind === 'address';
          const category = venue.category
            ? CATEGORY_LABELS[venue.category]({}, { locale })
            : '';
          const details = isAddress
            ? [host_venue_address({}, { locale }), venueAddressLine(venue)]
            : venue.eligible
              ? [venueAddressLine(venue), category]
              : [category, host_venue_ineligible({}, { locale })];
          return (
            <div
              key={venue.providerId}
              data-venue={venue.providerId}
              role="option"
              aria-selected={checked}
              aria-disabled={venue.eligible ? undefined : true}
              tabIndex={venue.providerId === focusedId ? 0 : -1}
              onClick={() => venue.eligible && choose(venue)}
              onKeyDown={(event) => {
                if (!venue.eligible) return;
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  choose(venue);
                } else if (
                  event.key === 'ArrowDown' ||
                  event.key === 'ArrowRight'
                ) {
                  event.preventDefault();
                  move(venue.providerId, 1);
                } else if (
                  event.key === 'ArrowUp' ||
                  event.key === 'ArrowLeft'
                ) {
                  event.preventDefault();
                  move(venue.providerId, -1);
                }
              }}
              className={`flex items-start gap-3 rounded-box border px-3 py-2.5 transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none ${
                venue.eligible
                  ? `cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                      checked
                        ? 'border-primary bg-base-100'
                        : 'border-transparent hover:bg-base-200'
                    }`
                  : 'cursor-not-allowed border-transparent opacity-70'
              }`}
            >
              <span
                aria-hidden="true"
                aria-checked={checked}
                className={`radio radio-primary mt-0.5 shrink-0 ${
                  venue.eligible ? '' : 'opacity-40'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold text-base-content">
                  <bdi>{venue.name}</bdi>
                </span>
                <span className="flex items-center gap-1 text-caption text-neutral">
                  {isAddress && (
                    <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    <bdi>{details.filter(Boolean).join(' · ')}</bdi>
                  </span>
                </span>
              </span>
              {checked && (
                <span className="shrink-0 self-center text-caption font-semibold text-primary">
                  {host_venue_selected({}, { locale })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {showAttribution && venues.length > 0 && (
        <p className="mt-2 text-caption text-neutral">
          {host_osm_attribution({}, { locale })}
        </p>
      )}
    </div>
  );
};
