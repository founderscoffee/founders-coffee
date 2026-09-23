import { useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  host_time_invalid,
  host_time_nonexistent,
  host_time_zone_error,
  localizedName,
  type Locale,
  type ZonedDateTimeError,
} from '@founders-coffee/i18n';

import { hostCreateStepCopy, hostCreateViewCopy } from './host-create-copy';
import { hostScheduleSummary } from './host-create-schedule';
import { writeHostCreateDraft } from './host-create-draft';
import { useHostCreateDraftState } from './useHostCreateDraftState';
import {
  firstInvalidField,
  focusInvalidField,
  validateDetailsStep,
  validateScheduleStep,
  validateVenueStep,
  type HostCreateFieldErrors,
} from './host-create-validation';
import type { RepeatEventTemplate } from './api';
import type { VenueSelection } from './types';
import { useHostPublish } from './useHostPublish';
import { useAuth } from '../../lib/app-providers';
import { hasProfileName } from '../profile/name-validation';

export const TOTAL_STEPS = 3;

export const useHostCreateWizard = ({
  locale,
  market,
  city,
  repeatTemplate,
  isAuthenticated,
  isAuthLoading,
}: {
  locale: Locale;
  market: Market;
  city: geo.GeoCity | null;
  repeatTemplate?: RepeatEventTemplate | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}) => {
  const { user } = useAuth();
  const cityName = localizedName(city ?? market, locale);
  const [fieldErrors, setFieldErrors] = useState<HostCreateFieldErrors>({});
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const [needsReauthentication, setNeedsReauthentication] = useState(false);
  const {
    draft,
    isRepeat,
    setStep,
    setVenue,
    setVenueName,
    setSearchValue,
    setStartsAt,
    setEndsAt,
    setTitle,
    setDescription,
    setLanguage,
  } = useHostCreateDraftState({
    locale,
    marketCode: market.code,
    repeatTemplate,
  });
  const { step, venue, venueName, startsAt, endsAt, title, description } =
    draft;
  const {
    publishing,
    publishError,
    clearPublishError,
    publish: publishEvent,
  } = useHostPublish({
    locale,
    market,
    readDraft: () => draft,
    onAuthRequired: () => {
      setNeedsReauthentication(true);
      setIsAuthGateOpen(true);
    },
  });
  /**
   * Take a venue the server verified, and decide who names it.
   *
   * A point of interest names itself. Where the provider could only confirm a street address the
   * name is cleared rather than pre-filled with it, because "15 Rue Yousfi Mohamed" is an address
   * masquerading as a venue name — leaving it in place would let a host publish it by accident.
   *
   * The search box is left alone. Results are now a list under the field rather than a dropdown
   * over it, so writing the chosen address back into the input would re-run the search and replace
   * the very list the host just picked from.
   */
  const selectVenue = (selection: VenueSelection) => {
    setVenue(selection);
    setVenueName(selection.kind === 'poi' ? selection.name : '');
    setFieldErrors((current) => ({
      ...current,
      venue: undefined,
      venueName: undefined,
    }));
  };
  const clearVenue = () => {
    setVenue(null);
    setVenueName('');
    setSearchValue('');
  };
  const setSchedule = (
    nextStartsAt: number | null,
    nextEndsAt: number | null,
  ) => {
    setStartsAt(nextStartsAt);
    setEndsAt(nextEndsAt);
    setFieldErrors((current) => ({ ...current, schedule: undefined }));
    clearPublishError();
  };
  const setScheduleError = (error: ZonedDateTimeError | null) => {
    const message =
      error === 'nonexistent_time'
        ? host_time_nonexistent({}, { locale })
        : error === 'invalid_time_zone'
          ? host_time_zone_error({}, { locale })
          : error
            ? host_time_invalid({}, { locale })
            : undefined;
    setFieldErrors((current) => ({ ...current, schedule: message }));
  };
  const validateCurrentStep = (): boolean => {
    const errors =
      step === 1
        ? validateVenueStep(venue, venueName, locale)
        : step === 2
          ? validateScheduleStep(startsAt, endsAt, locale)
          : validateDetailsStep({ title, description }, locale);
    setFieldErrors(errors);
    const first = firstInvalidField(errors);
    if (first) focusInvalidField(first);
    return first === null;
  };
  const publish = () => {
    if (!venue || startsAt === null || endsAt === null) return;
    void publishEvent({
      marketCode: market.code,
      cityCode: city?.code,
      title,
      description,
      language: draft.language,
      venueName,
      venueProviderId: venue.providerId,
      venueAddress: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
      startsAt,
      endsAt,
    });
  };

  /**
   * Advance, or publish from the last step.
   *
   * Every step validates, including the last one. When the details step was followed by a review
   * screen its validation ran on the way out of it; now it is the final step, so skipping the check
   * here would send an invalid title straight to the server — and, for an anonymous host, only
   * after they had signed in for it.
   */
  const next = () => {
    if (!validateCurrentStep()) return;
    if (step < TOTAL_STEPS) {
      clearPublishError();
      setStep((current) => current + 1);
      return;
    }
    if (isAuthLoading) return;
    if (!isAuthenticated || !hasProfileName(user)) {
      writeHostCreateDraft(market.code, draft);
      setIsAuthGateOpen(true);
      return;
    }
    publish();
  };
  const goToStep = (target: number) => {
    clearPublishError();
    setFieldErrors({});
    setStep(target);
  };
  const prev = () => goToStep(Math.max(1, step - 1));
  const stepCopy = hostCreateStepCopy(locale, cityName);
  const schedule = hostScheduleSummary(
    startsAt,
    endsAt,
    locale,
    market.timezone,
  );

  return {
    ...draft,
    ...schedule,
    fieldErrors,
    publishing,
    publishError,
    goToStep,
    stepLabels: stepCopy.labels,
    stepTitle: stepCopy.titles[step - 1] ?? stepCopy.titles[0],
    stepSub: stepCopy.descriptions[step - 1] ?? null,
    view: hostCreateViewCopy(),
    isAuthGateOpen,
    needsReauthentication,
    isRepeat,
    closeAuthGate: () => setIsAuthGateOpen(false),
    onGateAuthenticated: () => {
      setNeedsReauthentication(false);
      setIsAuthGateOpen(false);
      publish();
    },
    isActionDisabled: publishing || isAuthLoading || isAuthGateOpen,
    setSearchValue,
    setVenueName: (value: string) => {
      setVenueName(value);
      setFieldErrors((current) => ({ ...current, venueName: undefined }));
    },
    setLanguage,
    setTitle: (value: string) => {
      setTitle(value);
      setFieldErrors((current) => ({ ...current, title: undefined }));
    },
    setDescription: (value: string) => {
      setDescription(value);
      setFieldErrors((current) => ({ ...current, description: undefined }));
    },
    setSchedule,
    setScheduleError,
    selectVenue,
    clearVenue,
    next,
    prev,
  };
};
