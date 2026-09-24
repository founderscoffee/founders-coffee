import { useRef, useState } from 'react';

import { localizedName, type Locale } from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';
import type { geo } from '@founders-coffee/domain';

import { useCitySearch } from '../../features/geo/hooks';

type HeroCitySearchProps = {
  marketCode: string;
  locale: Locale;
  placeholder: string;
  noMatchText: string;
  selected?: geo.GeoCity;
  onSelect: (city: geo.GeoCity) => void;
  onClear: () => void;
  className?: string;
};

export const HeroCitySearch = ({
  marketCode,
  locale,
  placeholder,
  noMatchText,
  selected,
  onSelect,
  onClear,
  className,
}: HeroCitySearchProps) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMouseDown = useRef(false);

  const { data, isFetching } = useCitySearch(marketCode, query);
  const results = data ?? [];
  const listboxId = 'hero-city-listbox';
  const showNoMatch =
    open && query.trim().length > 0 && !isFetching && results.length === 0;
  const showList = open && results.length > 0;

  const inputValue = selected ? localizedName(selected, locale) : query;

  const choose = (city: geo.GeoCity) => {
    onSelect(city);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const clear = () => {
    onClear();
    setQuery('');
    setOpen(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length === 0) return;
      const idx =
        activeIndex >= 0 && activeIndex < results.length ? activeIndex : 0;
      choose(results[idx].city);
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((p) => (p < results.length - 1 ? p + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((p) => (p > 0 ? p - 1 : results.length - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className={`relative flex items-center ${className ?? ''}`}>
      <span
        className="pointer-events-none absolute start-4 size-4 rounded-full border-[1.5px] border-taupe"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        className="input h-12 w-full border-0 bg-transparent ps-11 pe-10 text-body shadow-none focus:outline-none"
        placeholder={placeholder}
        value={inputValue}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `hero-city-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-label={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onClear();
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!isMouseDown.current) {
            setOpen(false);
            setActiveIndex(-1);
          }
          isMouseDown.current = false;
        }}
      />
      {isFetching && query && (
        <span
          className="loading loading-spinner loading-xs absolute end-3 top-1/2 -translate-y-1/2 text-taupe"
          aria-hidden="true"
        />
      )}
      {selected && !isFetching && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear selection"
          className="absolute end-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-taupe hover:bg-base-200 hover:text-base-content"
        >
          ✕
        </button>
      )}
      {showNoMatch && (
        <StatusMessage
          variant="info"
          className="absolute start-0 top-full z-20 mt-1 w-full shadow-lg"
        >
          {noMatchText.replace('{query}', query)}
        </StatusMessage>
      )}
      {showList && (
        <ul
          id={listboxId}
          className="absolute start-0 top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
          role="listbox"
          aria-label={placeholder}
          onMouseDown={() => {
            isMouseDown.current = true;
          }}
        >
          {results.map((r: geo.CitySearchResult, i: number) => (
            <li
              key={`${r.city.stateCode}-${r.city.code}`}
              id={`hero-city-option-${i}`}
              role="option"
              aria-selected={selected?.code === r.city.code}
            >
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-start text-body-sm ${
                  i === activeIndex ? 'bg-base-200' : 'hover:bg-base-200'
                }`}
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r.city);
                }}
              >
                <span>{localizedName(r.city, locale)}</span>
                <span className="text-caption text-neutral">
                  {localizedName(r.state, locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
