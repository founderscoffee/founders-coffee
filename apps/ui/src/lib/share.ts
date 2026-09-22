import { shortId } from '@founders-coffee/core';
import type { Locale } from '@founders-coffee/i18n';

export type ShareText = {
  readonly title: string;
  readonly text: string;
  readonly url: string;
};

export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

/**
 * The address to hand out for an event, which is not the address being read.
 *
 * An Arabic slug percent-encodes to around 167 characters, and the encoded form is what a
 * messenger pastes: a wall of `%D9%82%D9%87%D9%88%D8%A9` reads as spam on WhatsApp, which is how
 * this product is passed around. This form is ASCII and a fixed length whatever the title says,
 * and the route it names answers a redirect to the canonical page, so the Arabic slug stays the
 * address search engines index and the one the reader's address bar shows once they arrive.
 *
 * The id travels without its `evt_` prefix, the same way the slug's own suffix carries it.
 *
 * The locale is in the link rather than left to the recipient's cookie, so a link written in
 * French opens in French on a device that has never been here.
 *
 * Built from `window.location.origin` rather than `canonicalUrl`, so it is right on every origin
 * without dragging the request-context module into a client bundle. Nothing of the current
 * address survives, so a cursor or a campaign tag picked up on the way in is not passed on to
 * everyone the link reaches.
 */
export const eventShareUrl = (locale: Locale, eventId: string): string =>
  `${window.location.origin}/${locale}/e/${shortId(eventId)}`;

/**
 * Offer a page to the operating system's share sheet.
 *
 * Nothing is awaited before `navigator.share`, and that is the contract: the call consumes the
 * transient activation of the click that led here, so a caller that awaits anything first gets
 * `NotAllowedError` instead of a share sheet. Call this synchronously from the handler.
 *
 * `AbortError` means the reader closed the sheet, and it is reported as `dismissed` so the caller
 * stays quiet rather than offering a fallback nobody asked for. The specification also raises it
 * when the device has no share targets at all, which is indistinguishable here; that reader gets
 * a button that appears to do nothing, which is the one case this mapping gets wrong.
 *
 * Everything else — no API, a `web-share` permissions policy, a spent activation — is
 * `unavailable`, which is the caller's signal to show the fallback.
 */
export const shareNatively = async (data: ShareText): Promise<ShareOutcome> => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function')
    return 'unavailable';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (cause) {
    return cause instanceof Error && cause.name === 'AbortError'
      ? 'dismissed'
      : 'unavailable';
  }
};

/**
 * Put a link on the clipboard, reporting whether it landed.
 *
 * `navigator.clipboard` needs a secure context of its own, so it can be missing on exactly the
 * browsers that have no share sheet either. A false return is not an error to log; it is the
 * signal to leave the link on screen for the reader to copy by hand.
 */
export const copyLink = async (url: string): Promise<boolean> => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.clipboard?.writeText !== 'function'
  )
    return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};
