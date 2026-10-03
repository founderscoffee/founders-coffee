import { useEffect, useRef, useState } from 'react';

import { takeJoinIntent } from './join-intent';

type JoinAfterSignInOptions = {
  eventId: string;
  isSignedIn: boolean;
  canJoin: boolean;
  join: () => void;
};

/**
 * Finish the Join a reader pressed before signing in, once sign-in has brought them back, and bring
 * the RSVP box into view so they see their seat being taken.
 *
 * The first render that knows the reader is signed in spends the intent, and the render after it
 * joins. Joining from the effect that spends it would start the mutation during the mount, which
 * StrictMode runs twice: TanStack Query's observer leaves its mutation when the first mount is torn
 * down and does not rejoin it, so the button stayed on "Saving your seat…" and the success handler
 * never ran.
 *
 * A reader who can no longer join — the meetup has started or been called off, they host it, or
 * they are already going — is left as they are, and the intent is spent all the same.
 */
export const useJoinAfterSignIn = ({
  eventId,
  isSignedIn,
  canJoin,
  join,
}: JoinAfterSignInOptions) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDue, setIsDue] = useState(false);

  useEffect(() => {
    if (isSignedIn && takeJoinIntent(eventId)) setIsDue(true);
  }, [eventId, isSignedIn]);

  useEffect(() => {
    if (!isDue) return;
    setIsDue(false);
    if (!canJoin) return;
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    join();
  }, [isDue, canJoin, join]);

  return ref;
};
