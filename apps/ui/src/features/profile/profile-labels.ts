import {
  formatDate,
  locale_ar,
  locale_en,
  locale_fr,
  spoken_es,
  spoken_de,
  spoken_ber,
  stage_building,
  stage_idea,
  stage_launched,
  topic_investing,
  topic_software_development,
  topic_building_products,
  topic_idea_validation,
  topic_cofounders,
  topic_partnerships,
  topic_experience_sharing,
  topic_learning_new_skills,
  topic_bootstrapping,
  topic_community,
  topic_design,
  topic_engineering,
  topic_finding_customers,
  topic_product,
  type Locale,
} from '@founders-coffee/i18n';
import { profile } from '@founders-coffee/domain';

const TOPIC_MESSAGES = {
  bootstrapping: topic_bootstrapping,
  product: topic_product,
  design: topic_design,
  engineering: topic_engineering,
  finding_customers: topic_finding_customers,
  community: topic_community,
  investing: topic_investing,
  software_development: topic_software_development,
  building_products: topic_building_products,
  idea_validation: topic_idea_validation,
  cofounders: topic_cofounders,
  partnerships: topic_partnerships,
  experience_sharing: topic_experience_sharing,
  learning_new_skills: topic_learning_new_skills,
} as const satisfies Record<
  (typeof profile.PROFILE_INTERESTS)[number],
  (input: Record<string, never>, options: { locale: Locale }) => string
>;

const LOCALE_MESSAGES = {
  ar: locale_ar,
  fr: locale_fr,
  en: locale_en,
  es: spoken_es,
  de: spoken_de,
  ber: spoken_ber,
} as const satisfies Record<
  (typeof profile.SPOKEN_LANGUAGES)[number],
  (input: Record<string, never>, options: { locale: Locale }) => string
>;

const STAGE_MESSAGES = {
  idea: stage_idea,
  building: stage_building,
  launched: stage_launched,
} as const satisfies Record<
  profile.ProfileStage,
  (input: Record<string, never>, options: { locale: Locale }) => string
>;

export const TOPIC_OPTIONS = profile.PROFILE_INTERESTS;
export const SPOKEN_LOCALE_OPTIONS = profile.SPOKEN_LANGUAGES;
export const STAGE_OPTIONS = profile.PROFILE_STAGES;

/** Label each domain interest through an exhaustive localized map. */
export const topicLabel = (
  topic: (typeof profile.PROFILE_INTERESTS)[number],
  locale: Locale,
): string => TOPIC_MESSAGES[topic]({}, { locale });

/** Name a spoken language in the reader's language, not in its own. */
export const localeLabel = (
  spoken: (typeof profile.SPOKEN_LANGUAGES)[number],
  locale: Locale,
): string => LOCALE_MESSAGES[spoken]({}, { locale });

/** Name how far along a member's project is, from the fixed set of stages. */
export const stageLabel = (
  stage: profile.ProfileStage,
  locale: Locale,
): string => STAGE_MESSAGES[stage]({}, { locale });

/** Name the month a member joined in the reader's language; the day is never sent. */
export const memberSinceLabel = (memberSince: string, locale: Locale): string =>
  formatDate(new Date(`${memberSince}-01T00:00:00Z`), locale, {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
