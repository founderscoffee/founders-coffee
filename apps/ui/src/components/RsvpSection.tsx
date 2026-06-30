import type { EventWithAttendance } from '@founders-coffee/server-fns';
import type { Locale } from '@founders-coffee/i18n';

/**
 * RSVP slot on the event-detail page ([`docs/p1-007-008-contract.md`](../../../docs/p1-007-008-contract.md)
 * §2). P1-007a ships this as a no-op so the detail layout + the `EventWithAttendance` contract are
 * stable before P1-007b / P1-008 branch off. P1-008 implements the real "I'm attending" / capacity /
 * cancel UI behind the same props — do not change this signature without amending the contract.
 */
export type RsvpSectionProps = {
  event: EventWithAttendance;
  locale: Locale;
};

export const RsvpSection = (_props: RsvpSectionProps): null => null;
