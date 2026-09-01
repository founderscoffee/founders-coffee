import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import {
  formatDate,
  host_publish_error,
  host_step1,
  host_step3,
  host_step3_sub,
  host_time_invalid,
  host_time_nonexistent,
  host_time_past,
  host_time_zone_error,
  type Locale,
  type ZonedDateTimeError,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';

import { useCreateEvent } from './hooks';
import type { VenueSelection } from './types';

const MIN_DURATION_MS = 30 * 60_000;

export const useHostCreateWizard = ({
  locale,
  market,
  city,
  isTurnstileBypassed,
}: {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  isTurnstileBypassed: boolean;
}) => {
  const navigate = useNavigate();
  const createEventMutation = useCreateEvent();

  const [step, setStep] = useState(1);
  const [venue, setVenue] = useState<VenueSelection | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (step !== 3) setTurnstileToken(null);
  }, [step]);

  const selectVenue = (selection: VenueSelection) => {
    setVenue(selection);
    setSearchValue(selection.address || selection.name);
  };

  const clearVenue = () => {
    setVenue(null);
    setSearchValue('');
  };

  const hasValidTimeRange =
    startsAt !== null &&
    endsAt !== null &&
    endsAt - startsAt >= MIN_DURATION_MS;

  const canProceed =
    step === 1
      ? !!venue
      : step === 2
        ? hasValidTimeRange
        : title.length >= 3 &&
          description.length >= 10 &&
          (isTurnstileBypassed || turnstileToken !== null);

  const whenLabel =
    startsAt !== null
      ? formatDate(new Date(startsAt), locale, {
          timeZone: market.timezone,
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  const durationMinutes =
    startsAt !== null && endsAt !== null
      ? Math.round((endsAt - startsAt) / 60_000)
      : 0;

  const dateTimeErrorMessage = (error: ZonedDateTimeError): string =>
    error === 'nonexistent_time'
      ? host_time_nonexistent({}, { locale })
      : error === 'invalid_time_zone'
        ? host_time_zone_error({}, { locale })
        : host_time_invalid({}, { locale });

  const setSchedule = (
    nextStartsAt: number | null,
    nextEndsAt: number | null,
  ) => {
    setStartsAt(nextStartsAt);
    setEndsAt(nextEndsAt);
    setPublishError(null);
  };

  const setScheduleError = (error: ZonedDateTimeError | null) => {
    setPublishError(error === null ? null : dateTimeErrorMessage(error));
  };

  const publish = async () => {
    if (!venue || startsAt === null || endsAt === null) return;
    if (!isTurnstileBypassed && turnstileToken === null) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await createEventMutation.mutateAsync({
        data: {
          event: {
            marketCode: market.code,
            cityCode: city.code,
            title,
            description,
            venueName: venue.name,
            venueAddress: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
            startsAt,
            endsAt,
            capacity: 0,
            language: locale === 'ar' ? 'ar' : locale,
            category: 'coffee-meetup',
          },
          turnstileToken: turnstileToken ?? undefined,
        },
      });
      void navigate({ to: '/$market', params: { market: market.slug } });
    } catch {
      setPublishError(host_publish_error({}, { locale }));
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setPublishing(false);
    }
  };

  const next = () => {
    if (step === 2 && !hasValidTimeRange) return;
    if (step === 2 && startsAt !== null && startsAt <= Date.now()) {
      setPublishError(host_time_past({}, { locale }));
      return;
    }
    setPublishError(null);
    return step === 3 ? publish() : setStep((s) => s + 1);
  };

  const prev = () => setStep((s) => Math.max(1, s - 1));

  return {
    step,
    venue,
    searchValue,
    startsAt,
    endsAt,
    title,
    description,
    publishing,
    publishError,
    turnstileResetKey,
    hasValidTimeRange,
    canProceed,
    whenLabel,
    durationMinutes,
    stepTitle:
      step === 1 ? host_step1({}, { locale }) : host_step3({}, { locale }),
    stepSub: step === 3 ? host_step3_sub({}, { locale }) : null,
    setSearchValue,
    setTitle,
    setDescription,
    setTurnstileToken,
    setSchedule,
    setScheduleError,
    selectVenue,
    clearVenue,
    next,
    prev,
  };
};
