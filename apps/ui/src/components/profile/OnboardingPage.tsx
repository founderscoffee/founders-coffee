import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import {
  hero_search_no_match,
  onboarding_city,
  onboarding_country,
  onboarding_save,
  onboarding_search_city,
  onboarding_state,
  onboarding_subtitle,
  onboarding_title,
  type Locale,
} from '@founders-coffee/i18n';
import type { geo } from '@founders-coffee/domain';

import { useUpdateProfile } from '../../features/profile/hooks';
import { CitySearchCombobox } from '../ui/CitySearchCombobox';
import type { Market } from '@founders-coffee/db';

type OnboardingPageProps = {
  locale: Locale;
  markets: readonly Market[];
  states: readonly geo.GeoState[];
  cities: readonly geo.GeoCity[];
  initialCountry: string;
  redirect: string;
  selectedState: string;
};

export const OnboardingPage = ({
  locale,
  markets,
  states,
  cities,
  initialCountry,
  redirect,
  selectedState,
}: OnboardingPageProps) => {
  const navigate = useNavigate();
  const updateProfileMutation = useUpdateProfile();

  const [country, setCountry] = useState<string>(initialCountry);
  const state = selectedState;
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setCity('');
    void navigate({ to: '/onboarding', search: { redirect } });
  };

  const handleStateChange = (code: string) => {
    setCity('');
    void navigate({
      to: '/onboarding',
      search: code ? { redirect, state: code } : { redirect },
    });
  };

  const handleSave = async () => {
    if (!country || !state || !city) return;
    setSaving(true);
    await updateProfileMutation.mutateAsync({
      data: { marketCode: country, state, city },
    });
    const marketSlug =
      markets.find((m) => m.code === country)?.slug ?? 'algeria';
    if (redirect !== '/') {
      window.location.assign(redirect);
      return;
    }
    void navigate({ to: '/$market', params: { market: marketSlug } });
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body gap-4">
          <div className="text-center">
            <h1 className="font-display text-h3 font-semibold">
              {onboarding_title({}, { locale })}
            </h1>
            <p className="mt-1 text-body-sm text-neutral">
              {onboarding_subtitle({}, { locale })}
            </p>
          </div>

          <ul className="steps steps-horizontal w-full">
            <li className={`step ${country ? 'step-primary' : ''}`}>
              {onboarding_country({}, { locale })}
            </li>
            <li className={`step ${state ? 'step-primary' : ''}`}>
              {onboarding_state({}, { locale })}
            </li>
            <li className={`step ${city ? 'step-primary' : ''}`}>
              {onboarding_city({}, { locale })}
            </li>
          </ul>

          <label className="form-control">
            <span className="mb-1 text-body-sm text-neutral">
              {onboarding_country({}, { locale })}
            </span>
            <select
              className="select select-bordered"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              {markets.map((m) => (
                <option key={m.code} value={m.code}>
                  {locale === 'ar' ? (m.nameAr ?? m.name) : m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="mb-1 text-body-sm text-neutral">
              {onboarding_state({}, { locale })}
            </span>
            <select
              className="select select-bordered"
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
              disabled={!country}
            >
              <option value="">-</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {locale === 'ar' ? s.nameAr : s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="form-control">
            <span className="mb-1 text-body-sm text-neutral">
              {onboarding_city({}, { locale })}
            </span>
            <CitySearchCombobox
              cities={cities}
              value={city}
              onSelect={setCity}
              placeholder={onboarding_search_city({}, { locale })}
              noMatchText={hero_search_no_match(
                { query: '{query}' },
                { locale },
              )}
              disabled={!state}
              locale={locale}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={!country || !state || !city || saving}
            onClick={handleSave}
          >
            {onboarding_save({}, { locale })}
          </button>
        </div>
      </div>
    </div>
  );
};
