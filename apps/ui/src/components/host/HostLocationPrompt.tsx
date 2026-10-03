import { Crosshair } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { geo } from '@founders-coffee/domain';
import {
  host_locate_me,
  host_location_prompt_body,
  host_location_prompt_city_label,
  host_location_prompt_later,
  host_location_prompt_missed,
  host_location_prompt_title,
  type Locale,
} from '@founders-coffee/i18n';

import { useDebouncedValue } from '../../features/geo/hooks';
import { CitySuggestions } from './CitySuggestions';
import type { LocationPromptReason } from './useLocationPrompt';

const TYPING_DELAY_MS = 350;

type HostLocationPromptProps = {
  locale: Locale;
  marketCode: string;
  cityCode?: string;
  reason: LocationPromptReason | null;
  onLocate: () => void;
  onCitySelect: (city: geo.GeoCity) => void;
  onClose: () => void;
};

export const HostLocationPrompt = ({
  locale,
  marketCode,
  cityCode,
  reason,
  onLocate,
  onCitySelect,
  onClose,
}: HostLocationPromptProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const missedId = useId();
  const bodyId = useId();
  const cityId = useId();
  const [typed, setTyped] = useState('');
  const query = useDebouncedValue(typed.trim(), TYPING_DELAY_MS);
  const isOpen = reason !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    if (!isOpen) setTyped('');
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={reason === 'missed' ? `${missedId} ${bodyId}` : bodyId}
      onClose={onClose}
    >
      <div className="modal-box max-w-md rounded-box border border-base-300 bg-base-100">
        <h2 id={titleId} className="font-display text-h4 font-semibold">
          {host_location_prompt_title({}, { locale })}
        </h2>
        {reason === 'missed' && (
          <p id={missedId} className="mt-2 text-body-sm text-base-content">
            {host_location_prompt_missed({}, { locale })}
          </p>
        )}
        <p
          id={bodyId}
          className="mt-2 text-body-sm leading-relaxed text-neutral"
        >
          {host_location_prompt_body({}, { locale })}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-xs sm:btn-sm md:btn-md mt-5 w-full"
          onClick={() => {
            onClose();
            onLocate();
          }}
        >
          <Crosshair className="size-4" aria-hidden="true" />
          {host_locate_me({}, { locale })}
        </button>
        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor={cityId} className="text-label text-neutral">
            {host_location_prompt_city_label({}, { locale })}
          </label>
          <input
            id={cityId}
            type="search"
            className="input input-sm md:input-md w-full"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
          <CitySuggestions
            locale={locale}
            marketCode={marketCode}
            query={query}
            currentCityCode={cityCode}
            onSelect={(city) => {
              onClose();
              onCitySelect(city);
            }}
          />
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost btn-xs sm:btn-sm md:btn-md"
            onClick={onClose}
          >
            {host_location_prompt_later({}, { locale })}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true">
          {host_location_prompt_later({}, { locale })}
        </button>
      </form>
    </dialog>
  );
};
