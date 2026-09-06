import { useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  host_login_required,
  host_or_click_map,
  host_page_title,
  host_progress_label,
  host_step_counter,
  host_step_progress,
  host_venue_rate_limited,
  host_venue_search_error,
  type Locale,
} from '@founders-coffee/i18n';

import { useHostMapContext } from '../../features/events/hooks';
import {
  TOTAL_STEPS,
  useHostCreateWizard,
} from '../../features/events/useHostCreateWizard';
import { useAuth } from '../../lib/app-providers';
import { DatetimePicker } from './DatetimePicker';
import { HostDetailsStep } from './HostDetailsStep';
import { HostMapPanel } from './HostMapPanel';
import { HostSignInGate } from './HostSignInGate';
import { HostVenueLine } from './HostVenueLine';
import { HostVenueStep } from './HostVenueStep';
import { HostWizardActions } from './HostWizardActions';
import { useStepFocus } from './useStepFocus';
import { WizardSteps } from './WizardSteps';

type HostCreatePageProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity | null;
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
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const mapContext = useHostMapContext({
    marketCode: market.code,
    cityCode: city?.code,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  useStepFocus(wizard.step, headingRef, scrollRef);

  const listCenter = mapCenter ??
    wizard.venue ??
    mapContext.data?.center ?? { latitude: 0, longitude: 0 };
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;
  const cityName = city ? (locale === 'ar' ? city.nameAr : city.name) : '';
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

  const venuePanel = wizard.venue ? (
    <HostVenueLine
      locale={locale}
      venue={wizard.venue}
      venueName={wizard.venueName}
    />
  ) : null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col md:min-h-[calc(100vh-4rem)] lg:flex-row">
      <section className="host-fade-up flex w-full flex-col border-base-300 bg-base-100 lg:h-[calc(100vh-4rem)] lg:w-[26rem] lg:shrink-0 lg:border-e xl:w-[30rem]">
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:p-7"
        >
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

          {wizard.step > 1 && venuePanel}

          {wizard.step === 1 && (
            <>
              <HostVenueStep
                locale={locale}
                cityName={cityName || marketName}
                cityCode={city?.code}
                center={listCenter}
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
            </>
          )}

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
            <HostDetailsStep
              locale={locale}
              title={wizard.title}
              description={wizard.description}
              constraints={wizard.view.constraints}
              errors={wizard.fieldErrors}
              onTitleChange={wizard.setTitle}
              onDescriptionChange={wizard.setDescription}
            />
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
        </div>

        {wizard.step === TOTAL_STEPS && (
          <div className="flex flex-col gap-2 border-t border-base-300 px-5 pt-4 md:px-7">
            {!isAuthenticated && (
              <p className="text-body-sm text-neutral" role="status">
                {host_login_required({}, { locale })}
              </p>
            )}
            {wizard.publishError && (
              <p className="text-body-sm text-error" role="alert">
                {wizard.publishError}
              </p>
            )}
          </div>
        )}

        <HostWizardActions
          locale={locale}
          step={wizard.step}
          isAuthenticated={isAuthenticated}
          isDisabled={wizard.isActionDisabled}
          isPublishing={wizard.publishing}
          onBack={wizard.prev}
          onNext={wizard.next}
          hint={
            wizard.step === 1 ? host_or_click_map({}, { locale }) : undefined
          }
        />
      </section>

      <div
        className={`h-72 shrink-0 lg:h-auto lg:min-h-0 lg:flex-1 ${
          wizard.step === 1 ? '' : 'hidden lg:block'
        }`}
      >
        <HostMapPanel
          locale={locale}
          accessToken={mapboxToken}
          marketCode={market.code}
          cityCode={city?.code}
          venue={wizard.venue}
          viewport={mapContext.data}
          isError={mapContext.isError}
          isInteractive={wizard.step === 1}
          onRetry={() => void mapContext.refetch()}
          onVenueSelect={wizard.selectVenue}
          onVenueInvalidate={wizard.clearVenue}
          onCenterChange={setMapCenter}
        />
      </div>
    </div>
  );
};
