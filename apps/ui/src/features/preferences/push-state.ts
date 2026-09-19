export type PushState =
  | 'checking'
  | 'unsupported'
  | 'install_required'
  | 'unavailable'
  | 'not_requested'
  | 'denied'
  | 'granted_unregistered'
  | 'delivery_unavailable'
  | 'registered';

export interface PushEnvironment {
  readonly hasNotificationApi: boolean;
  readonly messagingSupported: boolean;
  readonly installRequired: boolean;
  readonly configured: boolean;
  readonly permission: 'default' | 'granted' | 'denied';
  readonly registration: { registered: boolean; deliverable: boolean } | null;
}

/**
 * Name what is actually true about push on this device, in the order the member can act on it.
 *
 * Nine states rather than a switch, because a switch would be a lie in seven of them. The design
 * spec requires each to be visible and distinct, and they are ordered here by which obstacle the
 * member has to clear first: a browser that cannot receive notifications is not helped by being
 * told the site has not configured them, and neither is helped by a permission prompt.
 *
 * `install_required` before `configured` is deliberate. On the platforms that require it, adding
 * the app to the home screen is a prerequisite for the permission prompt to exist at all, so it
 * outranks anything about our own configuration.
 *
 * `granted_unregistered` and `delivery_unavailable` are the two states a browser cannot report.
 * The first means permission was given but the token never reached us; the second means it did and
 * the session that owns it has since been signed out — from the devices screen, most likely by the
 * member themselves. Collapsing either into "on" is how a preferences screen ends up claiming
 * delivery that will not happen.
 *
 * `registration === null` is "not asked yet", not "no". It reads as `checking` so the grid never
 * flashes an answer it is about to contradict.
 */
export const pushStateFrom = (env: PushEnvironment): PushState => {
  if (!env.hasNotificationApi || !env.messagingSupported) return 'unsupported';
  if (env.installRequired) return 'install_required';
  if (!env.configured) return 'unavailable';
  if (env.permission === 'denied') return 'denied';
  if (env.permission === 'default') return 'not_requested';
  if (env.registration === null) return 'checking';
  if (!env.registration.registered) return 'granted_unregistered';
  return env.registration.deliverable ? 'registered' : 'delivery_unavailable';
};

/**
 * Whether the member can do anything about this state from inside the page.
 *
 * Two of nine, which is why the push grid renders a sentence rather than a switch. Browser
 * permission cannot be turned on by a page — only requested, once, from a gesture — so a control
 * that appeared to set it would be claiming an authority it does not have. The other seven states
 * have their remedy somewhere else entirely: the browser's site settings, the home screen, a
 * deployment configuration, or signing this device back in.
 */
export const pushIsActionable = (state: PushState): boolean =>
  state === 'not_requested' || state === 'granted_unregistered';

/**
 * Whether this platform hides the permission prompt until the app is installed.
 *
 * iOS is the case that exists today: Safari offers web push only to a home-screen app, and a
 * browser tab there reports the API as present while `requestPermission` can never succeed. Read
 * from the user agent because there is no capability to feature-detect — the API is there either
 * way, which is the whole problem.
 */
export const installRequiredFor = (
  userAgent: string,
  standalone: boolean,
): boolean => {
  const isIos =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (/macintosh/i.test(userAgent) && /mobile/i.test(userAgent));
  return isIos && !standalone;
};
