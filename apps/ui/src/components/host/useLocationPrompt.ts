import { useEffect, useState } from 'react';

export type LocationPromptReason = 'start' | 'missed';

/**
 * Whether the visitor is typing into a field, which a dialog opening would take the focus from.
 */
const isTyping = (): boolean => {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
  );
};

/**
 * When the host map asks a host where they are, so it can show them the cafés around them.
 *
 * A wizard opened without a city starts on the whole market, and the middle of Algeria is the
 * Sahara: a host tapping there lands in open country the map has no address for. So the map asks,
 * as it appears, for their location or their city. Once, and not over a field they are typing in,
 * a café they have already chosen or a city they came with. It asks again whenever a tap finds
 * nothing, city or not, since that is the map showing them it cannot help from where it is. Only a
 * wizard that can change city asks at all; a repeated meetup keeps the city it repeats.
 */
export const useLocationPrompt = ({
  canAsk,
  hasCity,
  hasVenue,
}: {
  canAsk: boolean;
  hasCity: boolean;
  hasVenue: boolean;
}) => {
  const [reason, setReason] = useState<LocationPromptReason | null>(null);

  useEffect(() => {
    if (canAsk && !hasCity && !hasVenue && !isTyping()) setReason('start');
  }, []);

  return {
    reason: canAsk ? reason : null,
    askAfterMiss: (): boolean => {
      if (canAsk) setReason('missed');
      return canAsk;
    },
    close: () => setReason(null),
  };
};
