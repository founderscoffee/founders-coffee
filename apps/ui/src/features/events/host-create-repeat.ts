import { events } from '@founders-coffee/domain';

import type { RepeatEventTemplate } from './api';
import type { HostCreateDraft } from './host-create-draft';
import type { MeetupLanguage, VenueSelection } from './types';

const repeatProviderId = (eventId: string): string => `repeat:${eventId}`;

const venueFrom = (template: RepeatEventTemplate): VenueSelection | null => {
  const address = events.eventVenueAddressSchema.safeParse(
    template.venueAddress,
  );
  const name = events.eventVenueNameSchema.safeParse(template.venue);
  if (
    !address.success ||
    !name.success ||
    template.latitude === null ||
    template.longitude === null ||
    !Number.isFinite(template.latitude) ||
    !Number.isFinite(template.longitude)
  ) {
    return null;
  }
  return {
    providerId: repeatProviderId(template.sourceEventId),
    kind: 'address',
    name: name.data,
    address: address.data,
    latitude: template.latitude,
    longitude: template.longitude,
  };
};

const languagesFrom = (
  template: RepeatEventTemplate,
): MeetupLanguage[] | null => {
  const languages = events.eventLanguagesSchema.safeParse(template.languages);
  return languages.success ? languages.data : null;
};

export const repeatDraftFrom = (
  template: RepeatEventTemplate,
): HostCreateDraft => {
  const venue = venueFrom(template);
  return {
    step: 1,
    venue,
    venueName: venue ? venue.name : '',
    searchValue: '',
    startsAt: null,
    endsAt: null,
    title: template.title,
    description: template.description,
    chosenLanguages: languagesFrom(template),
  };
};
