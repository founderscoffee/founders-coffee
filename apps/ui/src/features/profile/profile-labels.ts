import {
  locale_ar,
  locale_en,
  locale_fr,
  role_aspiring_founder,
  role_community_builder,
  role_designer,
  role_developer,
  role_founder,
  role_other,
  topic_bootstrapping,
  topic_community,
  topic_design,
  topic_engineering,
  topic_finding_customers,
  topic_product,
  type Locale,
} from '@founders-coffee/i18n';
import { profile } from '@founders-coffee/domain';

const ROLE_MESSAGES = {
  founder: role_founder,
  aspiring_founder: role_aspiring_founder,
  developer: role_developer,
  designer: role_designer,
  community_builder: role_community_builder,
  other: role_other,
} as const satisfies Record<
  (typeof profile.COMMUNITY_ROLES)[number],
  (input: Record<string, never>, options: { locale: Locale }) => string
>;

const TOPIC_MESSAGES = {
  bootstrapping: topic_bootstrapping,
  product: topic_product,
  design: topic_design,
  engineering: topic_engineering,
  finding_customers: topic_finding_customers,
  community: topic_community,
} as const satisfies Record<
  (typeof profile.PROFILE_INTERESTS)[number],
  (input: Record<string, never>, options: { locale: Locale }) => string
>;

const LOCALE_MESSAGES = {
  ar: locale_ar,
  fr: locale_fr,
  en: locale_en,
} as const;

export const COMMUNITY_ROLE_OPTIONS = profile.COMMUNITY_ROLES;
export const TOPIC_OPTIONS = profile.PROFILE_INTERESTS;
export const SPOKEN_LOCALE_OPTIONS = ['ar', 'fr', 'en'] as const;

/**
 * Label a stored enum value in the reader's language.
 *
 * The option lists above are re-exported from the domain because components may not import it at
 * runtime (AGENTS.md §16): the choices a member sees and the values the schema accepts have to be
 * the same list, and routing them through here is what keeps a component from inventing its own.
 *
 * The maps are `satisfies Record<(typeof ENUM)[number], …>`, so adding a role or topic to the
 * domain enum without adding its message is a type error rather than a value that renders as its
 * own storage key. That is the failure this indirection exists to prevent: `community_builder`
 * appearing verbatim in an Arabic profile.
 */
export const roleLabel = (
  role: (typeof profile.COMMUNITY_ROLES)[number],
  locale: Locale,
): string => ROLE_MESSAGES[role]({}, { locale });

/** Label a conversation topic; see {@link roleLabel} for why the map is exhaustive. */
export const topicLabel = (
  topic: (typeof profile.PROFILE_INTERESTS)[number],
  locale: Locale,
): string => TOPIC_MESSAGES[topic]({}, { locale });

/** Name a spoken language in the reader's language, not in its own. */
export const localeLabel = (spoken: Locale, locale: Locale): string =>
  LOCALE_MESSAGES[spoken]({}, { locale });
