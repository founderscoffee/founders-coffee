import { events } from '@founders-coffee/domain';
import {
  host_step1,
  host_step2,
  host_step2_sub,
  event_when,
  event_where,
  host_step3,
  host_step3_short,
  host_step3_sub,
  type Locale,
} from '@founders-coffee/i18n';

export const hostCreateStepCopy = (locale: Locale) => ({
  labels: [
    event_where({}, { locale }),
    event_when({}, { locale }),
    host_step3_short({}, { locale }),
  ],
  titles: [
    host_step1({}, { locale }),
    host_step2({}, { locale }),
    host_step3({}, { locale }),
  ],
  descriptions: [
    null,
    host_step2_sub({}, { locale }),
    host_step3_sub({}, { locale }),
  ],
});

export const hostCreateViewCopy = () => ({
  constraints: {
    titleMin: events.EVENT_TITLE_MIN_LENGTH,
    titleMax: events.EVENT_TITLE_MAX_LENGTH,
    descriptionMin: events.EVENT_DESCRIPTION_MIN_LENGTH,
    descriptionMax: events.EVENT_DESCRIPTION_MAX_LENGTH,
    venueNameMax: events.EVENT_VENUE_NAME_MAX_LENGTH,
  },
});
