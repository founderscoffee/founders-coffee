export type ShareText = {
  readonly title: string;
  readonly text: string;
  readonly url: string;
};

export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

/**
 * The address to hand out for the page being read.
 *
 * Built from `window.location` rather than from `canonicalUrl`, so it is right on every origin
 * without dragging the request-context module into a client bundle. The path is already canonical
 * by the time a reader sees it: the market and city loaders redirect anything else. Search and
 * hash are dropped, so a cursor or a campaign tag picked up on the way in is not passed on to
 * everyone the link reaches.
 */
export const currentShareUrl = (): string =>
  `${window.location.origin}${window.location.pathname}`;

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

/**
 * A WhatsApp draft carrying the invitation and the link.
 *
 * `wa.me` is the fallback that works everywhere the share sheet does not, including desktop
 * Firefox and Chrome on Linux, and it is the channel hosts in this market actually promote on.
 * The whole message is encoded as one parameter, so the text may contain Arabic and punctuation
 * without splitting the link off the end of it.
 */
export const whatsappShareUrl = (text: string, url: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
