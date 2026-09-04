import { CalendarClock, MapPin } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  host_duration_min,
  host_progress_label,
  host_step_progress,
  host_venue_rate_limited,
  host_venue_search_error,
  type Locale,
} from '@founders-coffee/i18n';

import { useHostMapContext } from '../../features/events/hooks';
import { useHostCreateWizard } from '../../features/events/useHostCreateWizard';
import { useAuth } from '../../lib/app-providers';
import { DatetimePicker } from './DatetimePicker';
import { HostConfirmationStep } from './HostConfirmationStep';
import { HostDetailsStep } from './HostDetailsStep';
import { HostMapPanel } from './HostMapPanel';
import { HostVenueStep } from './HostVenueStep';
import { HostWizardActions } from './HostWizardActions';
import { HostWizardHeader } from './HostWizardHeader';
import { Stepper } from './Stepper';

type HostCreatePageProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  mapboxToken: string;
};

const pillClass =
  'flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-base-300/70 bg-base-100 px-2.5 py-1 shadow-sm';

export const HostCreatePage = ({
  locale,
  market,
  city,
  mapboxToken,
}: HostCreatePageProps) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const mapContext = useHostMapContext({
    marketCode: market.code,
    cityCode: city.code,
    locale,
  });
  const mapContextError = mapContext.isError
    ? appErrorCode(mapContext.error) === 'rate_limited'
      ? host_venue_rate_limited({}, { locale })
      : host_venue_search_error({}, { locale })
    : undefined;
  const wizard = useHostCreateWizard({
    locale,
    market,
    city,
    isAuthenticated,
    isAuthLoading,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef(wizard.step);

  useEffect(() => {
    if (previousStepRef.current === wizard.step) return;
    previousStepRef.current = wizard.step;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    });
  }, [wizard.step]);

  const cityName = locale === 'ar' ? city.nameAr : city.name;
  const stepperSegments = [
    wizard.venue ? (
      <span key="location" className={pillClass}>
        <MapPin className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-semibold text-base-content">
          {wizard.venueName || wizard.venue.name}
        </span>
      </span>
    ) : null,
    wizard.hasValidTimeRange ? (
      <span key="time" className={pillClass}>
        <CalendarClock className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-semibold text-base-content">
          {wizard.whenLabel}
        </span>
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
          {host_duration_min({ n: wizard.durationMinutes }, { locale })}
        </span>
      </span>
    ) : null,
    null,
  ];
  const stepHeading = (
    <div className="mb-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-base-content outline-none"
      >
        {wizard.stepTitle}
      </h2>
      {wizard.stepSub && (
        <p className="mt-1 text-base text-base-content/60">{wizard.stepSub}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-24 md:pt-12 md:pb-16">
        <HostWizardHeader locale={locale} />

        <div className="mb-8">
          <Stepper
            current={wizard.step}
            total={4}
            segments={stepperSegments}
            labels={wizard.stepLabels}
            ariaLabel={host_progress_label({}, { locale })}
            statusText={host_step_progress(
              {
                current: wizard.step,
                total: 4,
                label: wizard.stepTitle,
              },
              { locale },
            )}
          />
        </div>

        {wizard.step === 1 ? (
          <div className="grid items-start gap-6 lg:grid-cols-[1.85fr_1fr]">
            <section className="host-fade-up rounded-2xl border border-base-300/60 bg-base-100/80 p-6 shadow-xl shadow-base-content/5 backdrop-blur-md lg:order-2">
              {stepHeading}
              <HostVenueStep
                locale={locale}
                cityName={cityName}
                cityCode={city.code}
                marketCode={market.code}
                searchValue={wizard.searchValue}
                venue={wizard.venue}
                venueName={wizard.venueName}
                nameError={wizard.fieldErrors.venueName}
                isDisabled={!mapContext.data}
                unavailableReason={mapContextError}
                onSearchChange={wizard.setSearchValue}
                onVenueNameChange={wizard.setVenueName}
                onVenueSelect={wizard.selectVenue}
              />
              {wizard.fieldErrors.venue && (
                <p className="mt-3 text-sm text-error" role="alert">
                  {wizard.fieldErrors.venue}
                </p>
              )}
            </section>
            <div className="lg:order-1">
              <HostMapPanel
                locale={locale}
                accessToken={mapboxToken}
                marketCode={market.code}
                cityCode={city.code}
                venue={wizard.venue}
                viewport={mapContext.data}
                isError={mapContext.isError}
                onRetry={() => void mapContext.refetch()}
                onVenueSelect={wizard.selectVenue}
                onVenueInvalidate={wizard.clearVenue}
              />
            </div>
          </div>
        ) : (
          <section className="host-fade-up mx-auto max-w-3xl rounded-2xl border border-base-300/60 bg-base-100/80 p-5 shadow-xl shadow-base-content/5 backdrop-blur-md md:p-7">
            {stepHeading}
            {wizard.step === 2 && (
              <div>
                <DatetimePicker
                  startsAt={wizard.startsAt}
                  endsAt={wizard.endsAt}
                  onChange={wizard.setSchedule}
                  onError={wizard.setScheduleError}
                  locale={locale}
                  timeZone={market.timezone}
                  timePlacement="top"
                />
                {wizard.fieldErrors.schedule && (
                  <p className="mt-3 text-sm text-error" role="alert">
                    {wizard.fieldErrors.schedule}
                  </p>
                )}
              </div>
            )}
            {wizard.step === 3 && (
              <HostDetailsStep
                locale={locale}
                title={wizard.title}
                description={wizard.description}
                capacity={wizard.capacity}
                language={wizard.language}
                category={wizard.category}
                constraints={wizard.view.constraints}
                languageOptions={wizard.view.languageOptions}
                categoryOptions={wizard.view.categoryOptions}
                errors={wizard.fieldErrors}
                onTitleChange={wizard.setTitle}
                onDescriptionChange={wizard.setDescription}
                onCapacityChange={wizard.setCapacity}
                onCapacityLimitChange={wizard.enableCapacityLimit}
                onLanguageChange={wizard.setLanguage}
                onCategoryChange={wizard.setCategory}
              />
            )}
            {wizard.step === 4 &&
              wizard.venue &&
              wizard.startsAt !== null &&
              wizard.endsAt !== null && (
                <HostConfirmationStep
                  locale={locale}
                  timeZone={market.timezone}
                  venue={wizard.venue}
                  venueName={wizard.venueName}
                  startsAt={wizard.startsAt}
                  endsAt={wizard.endsAt}
                  title={wizard.title}
                  description={wizard.description}
                  capacity={wizard.capacity}
                  languageLabel={wizard.view.languageLabel}
                  categoryLabel={wizard.view.categoryLabel}
                  isAuthenticated={isAuthenticated}
                  publishError={wizard.publishError}
                />
              )}
          </section>
        )}

        <HostWizardActions
          locale={locale}
          step={wizard.step}
          isAuthenticated={isAuthenticated}
          isDisabled={wizard.isActionDisabled}
          isPublishing={wizard.publishing}
          onBack={wizard.prev}
          onNext={wizard.next}
        />
      </div>
    </div>
  );
};
