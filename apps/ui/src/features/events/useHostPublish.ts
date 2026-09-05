import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { Locale } from '@founders-coffee/i18n';

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
 * Own the final submission of the host wizard: the mutation and both of its outcomes.
 *
 * Split out of `useHostCreateWizard` because publishing is a self-contained concern with its own
 * state and both outcome paths, and the wizard is already at the file-length ceiling with the step
 * machine it exists to run.
 */
export const useHostPublish = ({
  locale,
  market,
  readDraft,
  onAuthRequired,
}: {
  locale: Locale;
  market: Market;
  readDraft: () => HostCreateDraft;
  onAuthRequired: () => void;
}) => {
  const navigate = useNavigate();
  const router = useRouter();
  const createEventMutation = useCreateEvent();
  const invalidateCreatedEvent = useInvalidateCreatedEvent();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  /**
   * Recover from a failed publish without costing the host their work (EC-08).
   *
   * Nothing entered is cleared: the wizard state and the session draft both survive, so a paused
   * market or an exhausted rate limit costs one button press rather than four steps of re-entry.
   *
   * An expired session used to be the one failure the wizard could not resolve in place. It now
   * opens the sign-in gate on the confirmation step instead of navigating to `/login`, so the host
   * signs back in without losing sight of the summary they were about to publish. The draft is
   * still written first, because an OAuth provider takes the page away and back.
   */
  const handleFailure = (error: unknown) => {
    const failure = hostPublishFailure(error, locale);
    setPublishError(failure.message);
    if (!failure.requiresReauthentication) return;
    writeHostCreateDraft(market.code, readDraft());
    onAuthRequired();
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
    clearHostCreateDraft(market.code);
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
    setPublishing(true);
    setPublishError(null);
    try {
      handleSuccess(await createEventMutation.mutateAsync({ data: { event } }));
    } catch (error) {
      handleFailure(error);
    } finally {
      setPublishing(false);
    }
  };

  return {
    publishing,
    publishError,
    clearPublishError: () => setPublishError(null),
    publish,
  };
};
