import { isLocale, type Locale } from '@founders-coffee/i18n';

/**
 * The same page, read in another language.
 *
 * A locale prefix is not a route segment of its own here. `/ar/algeria` and `/algeria/algiers`
 * are the same two-parameter route, told apart by whether the first parameter parses as a locale,
 * and the prefix wins over the stored preference whenever it is present — which is right, because
 * a link someone shares has to open in the language it was written in.
 *
 * That is also why switching language cannot be a cookie alone: on a prefixed URL the cookie is
 * read and then ignored, so the page reloads in the language the reader just asked to leave. The
 * prefix has to be rewritten. Paths that carry no prefix — `/login`, `/profile/activity` — have no
 * prefixed form to rewrite to, and those do settle from the cookie, so they are left as they are.
 */
export const withLocale = (pathname: string, locale: Locale): string => {
  const [, first, ...rest] = pathname.split('/');
  return isLocale(first) ? ['', locale, ...rest].join('/') : pathname;
};

/**
 * A market or company landing page, addressed in the reader's language.
 *
 * Both sit in the same route: the locale goes in the `market` parameter and the destination — a
 * market slug like `algeria`, or a company page key like `terms` — in `city`. Linking this way
 * rather than to the bare `/algeria` or `/terms` is what keeps the reader out of a redirect, since
 * every unprefixed path answers 307 to its prefixed form before it renders anything.
 */
export const localizedLanding = (locale: Locale, key: string) => ({
  to: '/$market/$city' as const,
  params: { market: locale, city: key },
});

/**
 * A city page inside a market, addressed in the reader's language.
 *
 * Three segments, and the locale is the first: `/ar/algeria/algiers`. The two-segment
 * `/algeria/algiers` is the same page unprefixed, and it is the expensive form — `/$market/$city`
 * loads the city, throws the result away and answers 307, so an unprefixed link pays
 * `getCityLanding` twice and two document loads to reach what this one names outright.
 */
export const localizedCity = (
  locale: Locale,
  marketSlug: string,
  citySlug: string,
) => ({
  to: '/$market/$city/$subcity' as const,
  params: { market: locale, city: marketSlug, subcity: citySlug },
});

/**
 * An event page, addressed in the reader's language.
 *
 * The unprefixed `/$market/e/$slug` route still exists and still works; it is the form an
 * unprefixed inbound link arrives on, and it answers 307 to this one.
 */
export const localizedEvent = (
  locale: Locale,
  marketSlug: string,
  slug: string,
) => ({
  to: '/$market/$city/e/$slug' as const,
  params: { market: locale, city: marketSlug, slug },
});

/**
 * The host wizard, addressed in the reader's language.
 *
 * It used to sit at `/$market/host/create` with the market slug in the `market` slot, which is
 * the one route that read that parameter as a market rather than as a locale. The effect was that
 * `/algeria/host/create` had no prefixed form at all: the page settled from the cookie, and a
 * French member could not send anyone a French link to it. That address still answers, and now
 * answers 307 to this one.
 */
export const localizedHostCreate = (locale: Locale, marketSlug: string) => ({
  to: '/$market/$city/host/create' as const,
  params: { market: locale, city: marketSlug },
});

/**
 * The closeout screen, addressed in the language its prompt was written in.
 *
 * These two are private, authenticated pages with nothing in them for a crawler, so the prefix is
 * not here to serve a canonical. It is here because a link in a notification has to carry its own
 * language: the unprefixed `/closeout/$eventId` settles from the reader's cookie, so a host
 * prompted in French closed out in Arabic on any browser that had not visited the site before.
 *
 * Nothing had to be taught to read it. The root derives the locale from the first path segment
 * already, so a prefixed address resolves the same way every public page does, and the unprefixed
 * form answers 307 to this one for the notifications that are already in flight.
 */
export const localizedCloseout = (locale: Locale, eventId: string) => ({
  to: '/$market/closeout/$eventId' as const,
  params: { market: locale, eventId },
});

/** The feedback screen, on the same terms as {@link localizedCloseout}. */
export const localizedFeedback = (locale: Locale, eventId: string) => ({
  to: '/$market/feedback/$eventId' as const,
  params: { market: locale, eventId },
});

/** The host's edit screen for a published meetup, on the same terms as {@link localizedCloseout}. */
export const localizedEventEdit = (locale: Locale, eventId: string) => ({
  to: '/$market/edit/$eventId' as const,
  params: { market: locale, eventId },
});

/**
 * The same path with a leading language segment taken off, if it has one.
 *
 * Two callers need it and they must agree: the guard that refuses to send a reader back to the
 * sign-in page, and the header that hides the sign-in link while you are on it. A guard that only
 * knew how to spell `/login` let a crafted `?redirect=/fr/login` walk straight past it.
 */
export const withoutLocale = (pathname: string): string => {
  const [, first, ...rest] = pathname.split('/');
  return isLocale(first) ? `/${rest.join('/')}` : pathname;
};

/**
 * The sign-in page, addressed in the reader's language.
 *
 * Sign-in used to be `/login` and nothing else, so it rendered in whatever the cookie said. A
 * French reader who arrived on a shared French link and clicked sign in was answered in Arabic:
 * the prefix that had decided the page they came from had nothing to say about where they went
 * next. Shared links are how most readers arrive, which made that the common path.
 */
export const localizedLogin = (locale: Locale) => ({
  to: '/$market/login' as const,
  params: { market: locale },
});

/**
 * The reader's own profile, and the three screens beside it.
 *
 * Four addresses rather than one parameterised route, because they are four routes: the section
 * nav links straight at each, and a typo in one of these is caught where it is written rather
 * than at a 404. They are separate for the same reason {@link localizedCloseout} and
 * {@link localizedFeedback} are.
 */
export const localizedProfile = (locale: Locale) => ({
  to: '/$market/profile' as const,
  params: { market: locale },
});

/** The reader's own activity, on the same terms as {@link localizedProfile}. */
export const localizedProfileActivity = (locale: Locale) => ({
  to: '/$market/profile/activity' as const,
  params: { market: locale },
});

/** The reader's notification settings, on the same terms as {@link localizedProfile}. */
export const localizedProfileNotifications = (locale: Locale) => ({
  to: '/$market/profile/notifications' as const,
  params: { market: locale },
});

/** The reader's account and security screen, on the same terms as {@link localizedProfile}. */
export const localizedProfileAccount = (locale: Locale) => ({
  to: '/$market/profile/account' as const,
  params: { market: locale },
});

/** Profile completion after a fresh sign-in, on the same terms as {@link localizedLogin}. */
export const localizedOnboarding = (locale: Locale) => ({
  to: '/$market/onboarding' as const,
  params: { market: locale },
});

/**
 * Home, addressed as the reader's own market rather than as `/`.
 *
 * `/` is a redirect stub. It resolves a market and answers 307, and on a client navigation that
 * costs a geo lookup and a market lookup to arrive somewhere the caller could already have named —
 * the header brand alone was making eight server-function requests per click that way, which is
 * what put readers into the edge rate limiter. Every brand mark and home affordance links straight
 * at the market landing instead.
 *
 * The fallback to `/` is for the one case that cannot name a market: the market list itself did not
 * load. That is precisely when the redirect's own detection is worth paying for, so `/` keeps
 * earning its place for a bare-domain visit, where the geo read is a request header and free.
 */
export const localizedHome = (
  locale: Locale,
  marketSlug: string | undefined,
) =>
  marketSlug === undefined
    ? ({ to: '/' } as const)
    : localizedLanding(locale, marketSlug);
