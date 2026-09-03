import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';

import { safeRedirectPath } from '../../lib/redirect';
import type { EventCreateRequestInput } from './api';
import {
  clearHostCreateDraft,
  writeHostCreateDraft,
  type HostCreateDraft,
} from './host-create-draft';
import { hostPublishFailure } from './host-create-errors';
import { useCreateEvent, useInvalidateCreatedEvent } from './hooks';

export type EventCreateCommand = EventCreateRequestInput['event'];

/**
 * Own the final submission of the host wizard: verification, the mutation, and both outcomes.
 *
 * Split out of `useHostCreateWizard` because publishing is a self-contained concern with four
 * pieces of state of its own, and the wizard is already at the file-length ceiling with the step
 * machine it exists to run.
 */
export const useHostPublish = ({
  locale,
  market,
  city,
  isTurnstileBypassed,
  readDraft,
}: {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  isTurnstileBypassed: boolean;
  readDraft: () => HostCreateDraft;
}) => {
  const navigate = useNavigate();
  const router = useRouter();
  const createEventMutation = useCreateEvent();
  const invalidateCreatedEvent = useInvalidateCreatedEvent();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const goToLogin = () => {
    const redirect = safeRedirectPath(
      `${window.location.pathname}${window.location.search}`,
    );
    void navigate({ to: '/login', search: { redirect } });
  };

  /**
   * Recover from a failed publish without costing the host their work (EC-08).
   *
   * Nothing entered is cleared: the wizard state and the session draft both survive, so a paused
   * market, an exhausted rate limit or a lapsed verification costs one button press rather than
   * four steps of re-entry. The Turnstile response is the exception — it is single-use and the
   * server already consumed it, so the widget is actively reissued instead of leaving a spent
   * token that would fail the retry for a second, misleading reason.
   *
   * An expired session is the one failure the wizard cannot resolve in place. It writes the draft
   * before leaving so the round trip through login restores the confirmation step, and the cleared
   * token means the host returns to a fresh challenge rather than a replayed one.
   */
  const handleFailure = (error: unknown) => {
    const failure = hostPublishFailure(error, locale);
    setPublishError(failure.message);
    setTurnstileToken(null);
    setTurnstileResetKey((value) => value + 1);
    if (!failure.requiresReauthentication) return;
    writeHostCreateDraft(market.code, city.code, readDraft());
    goToLogin();
  };

  /**
   * Open the created event on its canonical route, with the views it changed already stale.
   *
   * The market feed, city feed and host profile are served by route loaders and cached queries
   * that predate this event, so both caches are dropped before the navigation — otherwise the host
   * lands on their new event and then finds it missing from every list that should contain it.
   */
  const handleSuccess = (created: {
    marketCode: string;
    cityCode: string;
    hostId: string;
    slug: string;
  }) => {
    clearHostCreateDraft(market.code, city.code);
    void invalidateCreatedEvent({
      marketCode: created.marketCode,
      cityCode: created.cityCode,
      hostId: created.hostId,
      slug: created.slug,
    });
    void router.invalidate();
    void navigate({
      to: '/$market/e/$slug',
      params: { market: market.slug, slug: created.slug },
    });
  };

  const publish = async (event: EventCreateCommand) => {
    if (publishing) return;
    if (!isTurnstileBypassed && turnstileToken === null) return;
    setPublishing(true);
    setPublishError(null);
    try {
      handleSuccess(
        await createEventMutation.mutateAsync({
          data: { event, turnstileToken: turnstileToken ?? undefined },
        }),
      );
    } catch (error) {
      handleFailure(error);
    } finally {
      setPublishing(false);
    }
  };

  return {
    publishing,
    publishError,
    turnstileToken,
    turnstileResetKey,
    clearPublishError: () => setPublishError(null),
    setTurnstileToken,
    goToLogin,
    publish,
  };
};
