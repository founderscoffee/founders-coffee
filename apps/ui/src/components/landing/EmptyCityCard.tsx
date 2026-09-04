import { Link } from '@tanstack/react-router';
import { Bell, Coffee } from 'lucide-react';
import { useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  hero_empty_city,
  hero_empty_cta,
  hero_empty_subtitle,
  hero_waitlist_prompt,
  type Locale,
} from '@founders-coffee/i18n';

import { WaitlistForm } from '../../features/waitlist/components/WaitlistForm';

type EmptyCityCardProps = {
  locale: Locale;
  market: Market;
  selectedCity: geo.GeoCity;
  cityDisplayName: string;
};

export const EmptyCityCard = ({
  locale,
  market,
  selectedCity,
  cityDisplayName,
}: EmptyCityCardProps) => {
  const [showWaitlist, setShowWaitlist] = useState(false);

  return (
    <div className="mx-auto mt-6 max-w-2xl rounded-box border border-base-300 bg-base-100 p-5 text-center md:text-start">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <h2 className="font-display text-body font-semibold text-base-content">
            {hero_empty_city({ city: cityDisplayName }, { locale })}
          </h2>
          <p className="text-body-sm leading-relaxed text-neutral">
            {hero_empty_subtitle({ city: cityDisplayName }, { locale })}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
          <Link
            to="/$market/host/create"
            params={{ market: market.slug }}
            search={{ city: selectedCity.code, state: selectedCity.stateCode }}
            className="btn btn-primary h-12 w-full gap-2 text-base font-semibold shadow-none transition md:w-48"
          >
            <Coffee className="size-4" />
            {hero_empty_cta({}, { locale })}
          </Link>
          <button
            type="button"
            onClick={() => setShowWaitlist((s) => !s)}
            className="btn btn-outline h-12 w-full gap-2 text-sm font-medium transition md:w-48"
          >
            <Bell className="size-4" />
            {hero_waitlist_prompt({}, { locale })}
          </button>
        </div>
      </div>
      {showWaitlist && (
        <div className="mt-6 border-t border-[rgba(90,60,40,0.08)] pt-6">
          <WaitlistForm
            locale={locale}
            marketCode={market.code}
            cityCode={selectedCity.code}
            cityName={cityDisplayName}
          />
        </div>
      )}
    </div>
  );
};
