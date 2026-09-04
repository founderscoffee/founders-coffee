import { useCallback, useMemo, useRef, useState } from 'react';

import type { Locale } from '@founders-coffee/i18n';
import type { geo } from '@founders-coffee/domain';

type CitySearchComboboxProps = {
  cities: readonly geo.GeoCity[];
  value: string;
  onSelect: (code: string) => void;
  placeholder: string;
  noMatchText: string;
  disabled?: boolean;
  locale: Locale;
  className?: string;
};

const MAX_VISIBLE = 20;

export const CitySearchCombobox = ({
  cities,
  value,
  onSelect,
  placeholder,
  noMatchText,
  disabled,
  locale,
  className,
}: CitySearchComboboxProps) => {
  const [citySearch, setCitySearch] = useState('');
  const [showCityList, setShowCityList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMouseDown = useRef(false);

  const filteredCities = useMemo(
    () =>
      citySearch
        ? cities.filter(
            (c) =>
              c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
              c.nameAr.includes(citySearch),
          )
        : cities,
    [cities, citySearch],
  );

  const visibleCities = filteredCities.slice(0, MAX_VISIBLE);
  const selected = cities.find((c) => c.code === value);
  const inputValue = value
    ? ((locale === 'ar' ? selected?.nameAr : selected?.name) ?? citySearch)
    : citySearch;

  const selectCity = useCallback(
    (code: string) => {
      onSelect(code);
      setCitySearch('');
      setShowCityList(false);
      setActiveIndex(-1);
    },
    [onSelect],
  );

  const clearSelection = useCallback(() => {
    onSelect('');
    setCitySearch('');
    setShowCityList(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleCities.length === 0) return;
      if (activeIndex >= 0 && activeIndex < visibleCities.length) {
        selectCity(visibleCities[activeIndex].code);
      } else {
        selectCity(visibleCities[0].code);
      }
      return;
    }

    if (visibleCities.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < visibleCities.length - 1 ? prev + 1 : 0,
        );
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : visibleCities.length - 1,
        );
        break;
      }
      case 'Escape': {
        setShowCityList(false);
        setActiveIndex(-1);
        break;
      }
    }
  };

  const handleMouseDown = () => {
    isMouseDown.current = true;
  };

  const handleBlur = () => {
    if (!isMouseDown.current) {
      setShowCityList(false);
      setActiveIndex(-1);
    }
    isMouseDown.current = false;
  };

  const listboxId = 'city-search-listbox';
  const showNoMatch = citySearch.length > 0 && visibleCities.length === 0;

  return (
    <div className={`relative flex items-center ${className ?? ''}`}>
      <span
        className="pointer-events-none absolute start-4 text-taupe"
        aria-hidden="true"
      >
        📍
      </span>
      <input
        ref={inputRef}
        type="text"
        className="input h-12 w-full border-0 bg-transparent ps-11 pe-10 shadow-none focus:outline-none"
        placeholder={placeholder}
        value={inputValue}
        role="combobox"
        aria-expanded={
          showCityList && (visibleCities.length > 0 || showNoMatch)
        }
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `city-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-label={placeholder}
        onChange={(e) => {
          setCitySearch(e.target.value);
          onSelect('');
          setShowCityList(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setShowCityList(true)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          onClick={clearSelection}
          aria-label="Clear selection"
          className="absolute end-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-taupe hover:bg-base-200 hover:text-base-content"
        >
          ✕
        </button>
      )}
      {showCityList && (visibleCities.length > 0 || showNoMatch) && (
        <ul
          ref={listRef}
          id={listboxId}
          className="absolute start-0 top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
          role="listbox"
          aria-label={placeholder}
          onMouseDown={handleMouseDown}
        >
          {showNoMatch ? (
            <li
              className="px-4 py-2.5 text-body-sm text-neutral"
              role="status"
              aria-live="polite"
            >
              {noMatchText.replace('{query}', citySearch)}
            </li>
          ) : (
            visibleCities.map((c, i) => (
              <li
                key={c.code}
                id={`city-option-${i}`}
                role="option"
                aria-selected={c.code === value}
              >
                <button
                  type="button"
                  className={`flex w-full px-4 py-2.5 text-start text-body-sm ${
                    i === activeIndex ? 'bg-base-200' : 'hover:bg-base-200'
                  }`}
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCity(c.code);
                  }}
                >
                  <span>{locale === 'ar' ? c.nameAr : c.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
