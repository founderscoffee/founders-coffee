import { events } from '@founders-coffee/domain';
import {
  host_step1,
  host_step1_helper,
  host_step2,
  host_step2_sub,
  host_step1_short,
  host_step2_short,
  host_step3,
  host_step3_short,
  host_step3_sub,
  type Locale,
} from '@founders-coffee/i18n';

export const hostCreateStepCopy = (locale: Locale, cityName: string) => ({
  labels: [
    host_step1_short({}, { locale }),
    host_step2_short({}, { locale }),
    host_step3_short({}, { locale }),
  ],
  titles: [
    host_step1({}, { locale }),
    host_step2({}, { locale }),
    host_step3({}, { locale }),
  ],
  descriptions: [
    host_step1_helper({ city: cityName }, { locale }),
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
  },
});
