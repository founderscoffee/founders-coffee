import { isAppleMobile } from './apple-mobile';

export type InstallPlatform = 'android' | 'ios';

export type InstallChoice = { readonly outcome: 'accepted' | 'dismissed' };

export type BeforeInstallPromptEvent = Event & {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<InstallChoice>;
};

export type InstallTiming = {
  readonly firstSeenAt: number;
  readonly visitStartedAt: number;
  readonly engagedAt: number | null;
};

export const ENGAGED_AFTER_MS = 20_000;
export const RETURN_AFTER_MS = 30 * 60_000;
export const RETURN_SETTLE_MS = 3_000;

const CAPTURE_KEY = '__fcInstallPrompt';

const ANDROID = /android/i;

const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Pinterest|musical_ly|BytedanceWebview|Line\/|MicroMessenger|GSA\//i;

const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS/i;

const IOS_VERSION = /OS (\d+)_(\d+)/;

type CapturingWindow = Window & {
  [CAPTURE_KEY]?: BeforeInstallPromptEvent;
};

/**
 * Whether an iPhone browser's Share menu offers Add to Home Screen.
 *
 * Safari always has. Chrome, Firefox and Edge on an iPhone gained it with iOS 16.4, so on an older
 * phone they would be shown two steps that lead nowhere.
 */
const canAddToHomeScreen = (userAgent: string): boolean => {
  if (!IOS_OTHER_BROWSER.test(userAgent)) return true;
  const [, major = '0', minor = '0'] = IOS_VERSION.exec(userAgent) ?? [];
  return Number(major) > 16 || (Number(major) === 16 && Number(minor) >= 4);
};

/**
 * Which install sheet a browser can be offered: the button on Android, the steps on an iPhone.
 *
 * An app's own browser (Instagram, Facebook, TikTok, Google's app and the like) can install
 * nothing, so it is offered nothing, and neither is a computer: its browsers keep their own
 * install button in the address bar.
 */
export const installPlatformFor = (
  userAgent: string,
): InstallPlatform | null => {
  if (IN_APP_BROWSER.test(userAgent)) return null;
  if (ANDROID.test(userAgent)) return 'android';
  return isAppleMobile(userAgent) && canAddToHomeScreen(userAgent)
    ? 'ios'
    : null;
};

/**
 * The listener that has to be in place before the app is, as source for a script in the head.
 *
 * Chrome announces that the app can be installed once per page, as soon as it has checked the
 * manifest, and on a returning visit that is often before a phone has finished hydrating. An
 * announcement nobody is listening for cannot be answered later, so the page holds on to it here.
 * Holding it also keeps Chrome's own banner away: the sheet replaces it, and a reader who says
 * "No thanks" to the sheet has said it to both.
 */
export const installCaptureScript = (): string =>
  `if(${ANDROID}.test(navigator.userAgent))addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.${CAPTURE_KEY}=e})`;

/**
 * The announcement the head script held before the app started, handed over once.
 */
export const takeCapturedInstallPrompt =
  (): BeforeInstallPromptEvent | null => {
    const capturing = window as CapturingWindow;
    const captured = capturing[CAPTURE_KEY] ?? null;
    delete capturing[CAPTURE_KEY];
    return captured;
  };

/**
 * Whether the page is running as the installed app rather than in a browser tab.
 */
export const isInstalledDisplay = (): boolean =>
  ('standalone' in navigator && navigator.standalone === true) ||
  window.matchMedia('(display-mode: standalone)').matches;

/**
 * When the install sheet may open, or null while a first visit waits for its first tap.
 *
 * A reader who first came here half an hour or more before this visit began is back for a second
 * time, and is offered it once the page has had three seconds to settle. A first visit waits for a
 * tap and twenty seconds, so nobody is asked to install something they have not used yet.
 */
export const installPromptDueAt = ({
  firstSeenAt,
  visitStartedAt,
  engagedAt,
}: InstallTiming): number | null => {
  if (visitStartedAt - firstSeenAt >= RETURN_AFTER_MS)
    return visitStartedAt + RETURN_SETTLE_MS;
  if (engagedAt === null) return null;
  return Math.max(engagedAt, visitStartedAt + ENGAGED_AFTER_MS);
};
