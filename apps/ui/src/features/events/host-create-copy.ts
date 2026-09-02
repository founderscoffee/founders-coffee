import { events } from '@founders-coffee/domain';
import {
  cat_coffee_meetup,
  cat_demo_day,
  cat_workshop,
  host_language_ar,
  host_language_ar_en,
  host_language_ar_fr,
  host_language_en,
  host_language_fr,
  host_step1,
  host_step1_helper,
  host_step2,
  host_step2_sub,
  host_step3,
  host_step3_sub,
  host_step4,
  host_step4_sub,
  type Locale,
} from '@founders-coffee/i18n';

export const hostCreateStepCopy = (locale: Locale) => ({
  labels: [
    host_step1({}, { locale }),
    host_step2({}, { locale }),
    host_step3({}, { locale }),
    host_step4({}, { locale }),
  ],
  descriptions: [
    host_step1_helper({}, { locale }),
    host_step2_sub({}, { locale }),
    host_step3_sub({}, { locale }),
    host_step4_sub({}, { locale }),
  ],
});

export const eventLanguageLabel = (
  language: events.EventLanguage,
  locale: Locale,
): string => {
  const labels = {
    ar: host_language_ar,
    en: host_language_en,
    fr: host_language_fr,
    ar_en: host_language_ar_en,
    ar_fr: host_language_ar_fr,
  };
  return labels[language]({}, { locale });
};

export const eventCategoryLabel = (
  category: events.EventCategory,
  locale: Locale,
): string => {
  const labels = {
    'coffee-meetup': cat_coffee_meetup,
    workshop: cat_workshop,
    'demo-day': cat_demo_day,
  };
  return labels[category]({}, { locale });
};

export const hostCreateViewCopy = (
  locale: Locale,
  language: events.EventLanguage,
  category: events.EventCategory,
) => ({
  constraints: {
    titleMin: events.EVENT_TITLE_MIN_LENGTH,
    titleMax: events.EVENT_TITLE_MAX_LENGTH,
    descriptionMin: events.EVENT_DESCRIPTION_MIN_LENGTH,
    descriptionMax: events.EVENT_DESCRIPTION_MAX_LENGTH,
    capacityMax: events.EVENT_CAPACITY_MAX,
  },
  languageOptions: events.EVENT_LANGUAGES.map((value) => ({
    value,
    label: eventLanguageLabel(value, locale),
  })),
  categoryOptions: events.EVENT_CATEGORIES.map((value) => ({
    value,
    label: eventCategoryLabel(value, locale),
  })),
  languageLabel: eventLanguageLabel(language, locale),
  categoryLabel: eventCategoryLabel(category, locale),
});
