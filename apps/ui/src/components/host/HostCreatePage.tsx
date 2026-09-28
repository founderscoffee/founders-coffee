import { useRef, useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  host_login_required,
  host_page_title,
  host_progress_label,
  host_repeat_notice,
  host_step_progress,
  localizedName,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { useHostMapContext } from '../../features/events/hooks';
import type { RepeatEventTemplate } from '../../features/events/api';
import {
  TOTAL_STEPS,
  useHostCreateWizard,
} from '../../features/events/useHostCreateWizard';
import { useAuth } from '../../lib/app-providers';
import type { SocialProvider } from '../auth/SocialSignIn';
import { HostDetailsStep } from './HostDetailsStep';
import { HostMapPanel } from './HostMapPanel';
import { HostIdentityGate } from './HostIdentityGate';
import { HostScheduleStep } from './HostScheduleStep';
import { HostVenueLine } from './HostVenueLine';
import { HostVenueStep } from './HostVenueStep';
import { HostWizardActions } from './HostWizardActions';
import { HostWizardHeader } from './HostWizardHeader';
import { useCitySwitch } from './useCitySwitch';
import { useStepFocus } from './useStepFocus';
import { useVenueOverlay } from './useVenueOverlay';
import { WizardSteps } from './WizardSteps';

type HostCreatePageProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity | null;
  mapboxToken: string;
  turnstileSiteKey: string | null;
  socialProviders: readonly SocialProvider[];
  repeatTemplate: RepeatEventTemplate | null;
};

export const HostCreatePage = ({
  locale,
  market,
  city,
  mapboxToken,
  turnstileSiteKey,
  socialProviders,
  repeatTemplate,
}: HostCreatePageProps) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [mapCenter, setMapCenter] = useState<{
    cityCode?: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const mapContext = useHostMapContext({
    marketCode: market.code,
    cityCode: city?.code,
    locale,
  });
  const wizard = useHostCreateWizard({
    locale,
    market,
    city,
    repeatTemplate,
    isAuthenticated,
    isAuthLoading,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useStepFocus(wizard.step, headingRef, scrollRef);
  const venueOverlay = useVenueOverlay();
  const switchCity = useCitySwitch({
    locale,
    marketSlug: market.slug,
    onSwitch: () => {
      wizard.clearVenue();
      venueOverlay.open();
    },
  });

  const listCenter = (mapCenter?.cityCode === city?.code ? mapCenter : null) ??
    wizard.venue ??
    mapContext.data?.center ?? { latitude: 0, longitude: 0 };
  const marketName = localizedName(market, locale);
  const stepHeading = (
    <div className="max-lg:contents lg:mb-2">
      <h1 className="sr-only">{host_page_title({}, { locale })}</h1>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-h3 font-semibold text-base-content outline-none max-lg:sr-only max-lg:scroll-mt-20"
      >
        {wizard.stepTitle}
      </h2>
      {wizard.stepSub && (
        <p className="text-body text-neutral lg:mt-1">{wizard.stepSub}</p>
      )}
      {wizard.isRepeat && repeatTemplate ? (
        <p
          className="rounded-box bg-secondary-tint px-3 py-2 text-body-sm text-base-content lg:mt-3"
          role="note"
        >
          {host_repeat_notice({ title: repeatTemplate.title }, { locale })}
        </p>
      ) : null}
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
    <div
      className={`grid min-h-dvh grid-cols-1 lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:grid-cols-[26rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto] xl:grid-cols-[30rem_minmax(0,1fr)] ${
        wizard.step === 1
          ? 'grid-rows-[auto_auto_minmax(16rem,1fr)_auto]'
          : 'grid-rows-[auto_1fr_auto]'
      }`}
    >
      <HostWizardHeader
        locale={locale}
        marketName={marketName}
        step={wizard.step}
      >
        {steps}
      </HostWizardHeader>
      <section className="host-fade-up relative flex min-h-0 flex-col border-base-300 bg-base-100 lg:col-start-1 lg:row-start-2 lg:border-e">
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4 lg:gap-4 lg:overflow-y-auto lg:px-7 lg:pt-5 lg:pb-7"
        >
          {wizard.isAuthGateOpen ? (
            <>
              {wizard.publishError && (
                <StatusMessage variant="error">
                  {wizard.publishError}
                </StatusMessage>
              )}
              <HostIdentityGate
                needsReauthentication={wizard.needsReauthentication}
                locale={locale}
                turnstileSiteKey={turnstileSiteKey}
                socialProviders={socialProviders}
                onCancel={wizard.closeAuthGate}
                onAuthenticated={wizard.onGateAuthenticated}
              />
            </>
          ) : (
            <>
              {stepHeading}

              {wizard.step > 1 && venuePanel}

              {wizard.step === 1 && (
                <HostVenueStep
                  locale={locale}
                  area={wizard.venueArea}
                  cityCode={city?.code}
                  center={listCenter}
                  marketCode={market.code}
                  searchValue={wizard.searchValue}
                  venue={wizard.venue}
                  venueName={wizard.venueName}
                  nameError={wizard.fieldErrors.venueName}
                  venueError={
                    wizard.fieldErrors.venue
                      ? {
                          message: wizard.fieldErrors.venue,
                          onDismiss: wizard.clearVenueError,
                        }
                      : undefined
                  }
                  overlay={venueOverlay.panel}
                  isDisabled={!mapContext.data}
                  onSearchChange={(value) => {
                    venueOverlay.open();
                    wizard.setSearchValue(value);
                  }}
                  onVenueNameChange={wizard.setVenueName}
                  onVenueSelect={wizard.selectVenue}
                  onCitySelect={wizard.isRepeat ? undefined : switchCity}
                />
              )}

              {wizard.step === 2 && (
                <HostScheduleStep
                  locale={locale}
                  timeZone={market.timezone}
                  startsAt={wizard.startsAt}
                  endsAt={wizard.endsAt}
                  error={wizard.fieldErrors.schedule}
                  onChange={wizard.setSchedule}
                  onError={wizard.setScheduleError}
                />
              )}

              {wizard.step === 3 && (
                <HostDetailsStep
                  locale={locale}
                  title={wizard.title}
                  description={wizard.description}
                  language={wizard.language}
                  constraints={wizard.view.constraints}
                  errors={wizard.fieldErrors}
                  onTitleChange={wizard.setTitle}
                  onDescriptionChange={wizard.setDescription}
                  onLanguageChange={wizard.setLanguage}
                />
              )}
            </>
          )}
        </div>

        {!wizard.isAuthGateOpen && wizard.step === TOTAL_STEPS && (
          <div className="flex flex-col gap-2 border-t border-base-300 px-4 pt-3 lg:px-7 lg:pt-4">
            {!isAuthenticated && (
              <StatusMessage variant="info">
                {host_login_required({}, { locale })}
              </StatusMessage>
            )}
            {wizard.publishError && (
              <StatusMessage variant="error">
                {wizard.publishError}
              </StatusMessage>
            )}
          </div>
        )}
      </section>

      <div
        className={`min-h-0 lg:col-start-2 lg:row-span-3 lg:row-start-1 ${
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
          error={mapContext.error}
          isInteractive={wizard.step === 1}
          covered={wizard.step === 1 ? venueOverlay.covered : 0}
          onRetry={() => void mapContext.refetch()}
          onVenueSelect={wizard.selectVenue}
          onVenueInvalidate={wizard.clearVenue}
          onCenterChange={(center) =>
            setMapCenter({ ...center, cityCode: city?.code })
          }
          onUserMove={venueOverlay.fold}
          onLocateResize={venueOverlay.onLocateResize}
        />
      </div>

      {!wizard.isAuthGateOpen && (
        <HostWizardActions
          locale={locale}
          marketSlug={market.slug}
          step={wizard.step}
          isAuthenticated={isAuthenticated}
          isDisabled={wizard.isActionDisabled}
          isPublishing={wizard.publishing}
          onBack={wizard.prev}
          onNext={() => {
            if (!wizard.venue) venueOverlay.open();
            wizard.next();
          }}
        />
      )}
    </div>
  );
};
