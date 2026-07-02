import { useCallback, useMemo, useRef, useState } from 'react'

import type { Locale } from '@founders-coffee/i18n'
import type { geo } from '@founders-coffee/domain'

type CitySearchComboboxProps = {
  cities: readonly geo.GeoCity[]
  value: string
  onSelect: (code: string) => void
  placeholder: string
  disabled?: boolean
  locale: Locale
  className?: string
}

const MAX_VISIBLE = 20

/**
 * Searchable city dropdown. Filters by name (LTR) or nameAr (includes). The selected city's
 * localized name is shown in the input until the user clears it to search again. Supports keyboard
 * navigation: ArrowUp/Down to move, Enter to select, Escape to close.
 */
export const CitySearchCombobox = ({
  cities,
  value,
  onSelect,
  placeholder,
  disabled,
  locale,
  className,
}: CitySearchComboboxProps) => {
  const [citySearch, setCitySearch] = useState('')
  const [showCityList, setShowCityList] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)
  const isMouseDown = useRef(false)

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
  )

  const visibleCities = filteredCities.slice(0, MAX_VISIBLE)
  const selected = cities.find((c) => c.code === value)
  const inputValue = value
    ? (locale === 'ar' ? selected?.nameAr : selected?.name) ?? citySearch
    : citySearch

  const selectCity = useCallback(
    (code: string) => {
      onSelect(code)
      setCitySearch('')
      setShowCityList(false)
      setActiveIndex(-1)
    },
    [onSelect],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCityList || visibleCities.length === 0) return

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        setActiveIndex((prev) => (prev < visibleCities.length - 1 ? prev + 1 : 0))
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : visibleCities.length - 1))
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < visibleCities.length) {
          selectCity(visibleCities[activeIndex].code)
        }
        break
      }
      case 'Escape': {
        setShowCityList(false)
        setActiveIndex(-1)
        break
      }
    }
  }

  const handleMouseDown = () => {
    isMouseDown.current = true
  }

  const handleBlur = () => {
    if (!isMouseDown.current) {
      setShowCityList(false)
      setActiveIndex(-1)
    }
    isMouseDown.current = false
  }

  const listboxId = 'city-search-listbox'

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        type="text"
        className="input input-bordered h-12 w-full ps-4 pe-10"
        placeholder={placeholder}
        value={inputValue}
        role="combobox"
        aria-expanded={showCityList && visibleCities.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `city-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-label={placeholder}
        onChange={(e) => {
          setCitySearch(e.target.value)
          onSelect('')
          setShowCityList(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setShowCityList(true)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
      />
      {showCityList && visibleCities.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          className="dropdown-content z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
          role="listbox"
          aria-label={placeholder}
          onMouseDown={handleMouseDown}
        >
          {visibleCities.map((c, i) => (
            <li key={c.code} id={`city-option-${i}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={`flex w-full justify-between px-4 py-2.5 text-start text-sm ${
                  i === activeIndex ? 'bg-base-200' : 'hover:bg-base-200'
                }`}
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectCity(c.code)
                }}
              >
                <span>{locale === 'ar' ? c.nameAr : c.name}</span>
                <span className="text-base-content/40">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
