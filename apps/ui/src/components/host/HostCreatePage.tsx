import { useEffect, useRef } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  host_next,
  host_or_click_map,
  host_page_title,
  host_progress_label,
  host_step_counter,
  host_step_progress,
  host_venue_rate_limited,
  host_venue_search_error,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { useHostMapContext } from '../../features/events/hooks';
import {
  TOTAL_STEPS,
  useHostCreateWizard,
} from '../../features/events/useHostCreateWizard';
import { useAuth } from '../../lib/app-providers';
import { DatetimePicker } from './DatetimePicker';
import { HostConfirmationStep } from './HostConfirmationStep';
import { HostDetailsStep } from './HostDetailsStep';
import { HostMapPanel } from './HostMapPanel';
import { HostSignInGate } from './HostSignInGate';
import { HostVenueStep } from './HostVenueStep';
import { HostWizardActions } from './HostWizardActions';
import { HostWizardHeader } from './HostWizardHeader';
import { WizardSteps } from './WizardSteps';

type HostCreatePageProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  mapboxToken: string;
  turnstileSiteKey: string | null;
  hasSocial: boolean;
};

export const HostCreatePage = ({
  locale,
  market,
  city,
  mapboxToken,
  turnstileSiteKey,
  hasSocial,
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
  const stepHeading = (
    <div className="mb-6">
      <h1 className="sr-only">{host_page_title({}, { locale })}</h1>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-h3 font-semibold text-base-content outline-none"
      >
        {wizard.stepTitle}
      </h2>
      {wizard.stepSub && (
        <p className="mt-1 text-body text-neutral">{wizard.stepSub}</p>
      )}
    </div>
  );

  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;
  const steps = (
    <WizardSteps
      current={wizard.step}
      labels={wizard.stepLabels}
      ariaLabel={host_progress_label({}, { locale })}
      statusText={host_step_progress(
        { current: wizard.step, total: TOTAL_STEPS, label: wizard.stepTitle },
        { locale },
      )}
    />
  );

  if (wizard.step === 1) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col md:min-h-[calc(100vh-4rem)] lg:flex-row">
        <section className="host-fade-up flex w-full flex-col border-base-300 bg-base-100 lg:h-[calc(100vh-4rem)] lg:w-[26rem] lg:shrink-0 lg:border-e xl:w-[30rem]">
          <div className="flex flex-col gap-4 overflow-y-auto p-5 md:p-7">
            <div className="flex items-center justify-between gap-3 text-caption text-neutral">
              <span className="truncate font-medium text-base-content">
                {marketName}
              </span>
              <span className="shrink-0">
                {host_step_counter(
                  { current: wizard.step, total: TOTAL_STEPS },
                  { locale },
                )}
              </span>
            </div>
            {steps}
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
              <p className="text-body-sm text-error" role="alert">
                {wizard.fieldErrors.venue}
              </p>
            )}
          </div>
          <div className="sticky inset-x-0 bottom-0 z-30 mt-auto flex items-center justify-between gap-3 border-t border-base-300 bg-base-100 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:px-7 lg:static lg:shadow-none">
            <Button
              variant="primary"
              onClick={wizard.next}
              disabled={wizard.isActionDisabled}
              className="h-12 min-w-28 px-6 text-base font-semibold"
            >
              {host_next({}, { locale })}
            </Button>
            <span className="text-caption text-neutral">
              {host_or_click_map({}, { locale })}
            </span>
          </div>
        </section>
        <div className="min-h-72 flex-1 lg:min-h-0">
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
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 pt-8 pb-24 md:pt-12 md:pb-16">
        <HostWizardHeader locale={locale} />

        <div className="mb-8">{steps}</div>

        <section className="host-fade-up mx-auto max-w-3xl rounded-box border border-base-300 bg-base-100 p-5 md:p-7">
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
                <p className="mt-3 text-body-sm text-error" role="alert">
                  {wizard.fieldErrors.schedule}
                </p>
              )}
            </div>
          )}
          {wizard.step === 3 && (
            <>
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
              {wizard.venue &&
                wizard.startsAt !== null &&
                wizard.endsAt !== null && (
                  <div className="mt-8 border-t border-base-300 pt-6">
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
                  </div>
                )}
              {wizard.isAuthGateOpen && (
                <HostSignInGate
                  locale={locale}
                  turnstileSiteKey={turnstileSiteKey}
                  hasSocial={hasSocial}
                  onCancel={wizard.closeAuthGate}
                  onAuthenticated={wizard.onGateAuthenticated}
                />
              )}
            </>
          )}
        </section>

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
