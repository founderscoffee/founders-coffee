import { isLocale, type Locale } from '@founders-coffee/i18n';

/**
 * The same page, read in another language.
 *
 * The prefix wins over the stored preference whenever it is present, which is right: a link
 * someone shares has to open in the language it was written in.
 *
 * That is also why switching language cannot be a cookie alone. On a prefixed URL the cookie is
 * read and then ignored, so the page would reload in the language the reader just asked to leave;
 * the prefix has to be rewritten. An address carrying no prefix to rewrite — a protocol file like
 * `/robots.txt` — is returned as it came.
 */
export const withLocale = (pathname: string, locale: Locale): string => {
  const [, first, ...rest] = pathname.split('/');
  return isLocale(first) ? ['', locale, ...rest].join('/') : pathname;
};

const ONLY_THIS_PAGE = { exact: true };

/**
 * A market or company landing page, addressed in the reader's language.
 *
 * `activeOptions` travels with the address because a link is active by path prefix unless told
 * otherwise, and a market landing is the prefix of every city and every meetup under it. Four
 * links on a city page announced themselves as the current page and none of them was it, so a
 * reader hearing the cue learned nothing from it anywhere.
 *
 * Both sit in the same route: `$market` holds a market slug like `algeria` or a company page key
 * like `terms`, and the route tells them apart by the key. Linking this way rather than to the bare
 * `/algeria` or `/terms` is what keeps the reader out of a redirect, since every unprefixed path
 * answers 307 to its prefixed form before it renders anything.
 */
export const localizedLanding = (locale: Locale, key: string) => ({
  to: '/$locale/$market' as const,
  params: { locale, market: key },
  activeOptions: ONLY_THIS_PAGE,
});

/**
 * A city page inside a market, addressed in the reader's language.
 *
 * Three segments, and the locale is the first: `/ar/algeria/algiers`. The two-segment
 * `/algeria/algiers` is the same page without its language, and it is the expensive form: the
 * layout answers it with this address, so an unprefixed link costs two document loads to reach what
 * this one names outright.
 */
export const localizedCity = (
  locale: Locale,
  marketSlug: string,
  citySlug: string,
) => ({
  to: '/$locale/$market/$city' as const,
  params: { locale, market: marketSlug, city: citySlug },
});

/**
 * An event page, addressed in the reader's language.
 *
 * The short `/$locale/e/$slug` route still exists and still works; it is the short form
 * `eventShareUrl` hands out, and it answers 307 to this one once it has looked the event up by id.
 */
export const localizedEvent = (
  locale: Locale,
  marketSlug: string,
  slug: string,
) => ({
  to: '/$locale/$market/e/$slug' as const,
  params: { locale, market: marketSlug, slug },
});

/**
 * The host wizard, addressed in the reader's language.
 *
 * It used to sit at `/$market/host/create`, reading the first segment as a market where every
 * other route read it as a locale. The effect was that `/algeria/host/create` had no prefixed form
 * at all: the page settled from the cookie, and a French member could not send anyone a French link
 * to it. That address still answers, through the layout that puts a language in front of it.
 */
export const localizedHostCreate = (locale: Locale, marketSlug: string) => ({
  to: '/$locale/$market/host/create' as const,
  params: { locale, market: marketSlug },
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
  to: '/$locale/closeout/$eventId' as const,
  params: { locale, eventId },
});

/** The feedback screen, on the same terms as {@link localizedCloseout}. */
export const localizedFeedback = (locale: Locale, eventId: string) => ({
  to: '/$locale/feedback/$eventId' as const,
  params: { locale, eventId },
});

/** The host's edit screen for a published meetup, on the same terms as {@link localizedCloseout}. */
export const localizedEventEdit = (locale: Locale, eventId: string) => ({
  to: '/$locale/edit/$eventId' as const,
  params: { locale, eventId },
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
  to: '/$locale/login' as const,
  params: { locale },
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
  to: '/$locale/profile' as const,
  params: { locale },
  activeOptions: ONLY_THIS_PAGE,
});

/** The reader's own activity, on the same terms as {@link localizedProfile}. */
export const localizedProfileActivity = (locale: Locale) => ({
  to: '/$locale/profile/activity' as const,
  params: { locale },
});

/** The reader's notification settings, on the same terms as {@link localizedProfile}. */
export const localizedProfileNotifications = (locale: Locale) => ({
  to: '/$locale/profile/notifications' as const,
  params: { locale },
});

/** The reader's account and security screen, on the same terms as {@link localizedProfile}. */
export const localizedProfileAccount = (locale: Locale) => ({
  to: '/$locale/profile/account' as const,
  params: { locale },
});

/** Profile completion after a fresh sign-in, on the same terms as {@link localizedLogin}. */
export const localizedOnboarding = (locale: Locale) => ({
  to: '/$locale/onboarding' as const,
  params: { locale },
});

/**
 * Somebody else's public profile, addressed in the language it is being shared in.
 *
 * This is the one address of the private set that a stranger opens. It is `noindex`, so the
 * missing prefix cost no search placement, but a profile shared from a French page opened in
 * whatever language the recipient's cookie happened to hold, which is the same defect as an event
 * link opening in the wrong one.
 */
export const localizedPublicProfile = (locale: Locale, userId: string) => ({
  to: '/$locale/u/$userId' as const,
  params: { locale, userId },
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
