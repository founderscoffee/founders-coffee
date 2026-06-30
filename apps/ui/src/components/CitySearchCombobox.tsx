import { useMemo, useState } from 'react'

import type { Locale } from '@founders-coffee/i18n'
import type { geo } from '@founders-coffee/domain'

type CitySearchComboboxProps = {
  cities: readonly geo.GeoCity[]
  value: string
  onSelect: (code: string) => void
  placeholder: string
  disabled?: boolean
  locale: Locale
}

/**
 * Searchable city dropdown. Filters the city list by name (LTR) or nameAr (includes). The selected
 * city's localized name is shown in the input until the user clears it to search again.
 */
export const CitySearchCombobox = ({
  cities,
  value,
  onSelect,
  placeholder,
  disabled,
  locale,
}: CitySearchComboboxProps) => {
  const [citySearch, setCitySearch] = useState('')
  const [showCityList, setShowCityList] = useState(false)

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

  const selected = cities.find((c) => c.code === value)
  const inputValue = value
    ? (locale === 'ar' ? selected?.nameAr : selected?.name) ?? citySearch
    : citySearch

  return (
    <div className="dropdown w-full">
      <input
        type="text"
        className="input input-bordered w-full"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setCitySearch(e.target.value)
          onSelect('')
          setShowCityList(true)
        }}
        onFocus={() => setShowCityList(true)}
        onBlur={() => setTimeout(() => setShowCityList(false), 200)}
        disabled={disabled}
      />
      {showCityList && filteredCities.length > 0 && (
        <ul
          className="dropdown-content z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
          role="listbox"
        >
          {filteredCities.slice(0, 50).map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="flex w-full justify-between px-4 py-2 text-start text-sm hover:bg-base-200"
                onClick={() => {
                  onSelect(c.code)
                  setCitySearch('')
                  setShowCityList(false)
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
