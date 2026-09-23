import { device_on, devices_unknown, type Locale } from '@founders-coffee/i18n';

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//u, 'Edge'],
  [/\bOPR\/|\bOpera\//u, 'Opera'],
  [/\bSamsungBrowser\//u, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//u, 'Firefox'],
  [/\bChrome\/|\bCriOS\//u, 'Chrome'],
  [/\bSafari\//u, 'Safari'],
];

const PLATFORMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone\b/u, 'iOS'],
  [/\biPad\b/u, 'iPadOS'],
  [/\bAndroid\b/u, 'Android'],
  [/\bCrOS\b/u, 'ChromeOS'],
  [/\bMacintosh\b|\bMac OS X\b/u, 'macOS'],
  [/\bWindows\b/u, 'Windows'],
  [/\bLinux\b|\bX11\b/u, 'Linux'],
];

const firstMatch = (
  table: readonly (readonly [RegExp, string])[],
  value: string,
): string | null => table.find(([pattern]) => pattern.test(value))?.[1] ?? null;

/**
 * What to call a signed-in device, in words the person whose account it is can act on.
 *
 * The security screen exists to answer one question — what can reach my account, and should I
 * sign any of it out — and it was answering with the string a browser sends to a server. A
 * hundred characters of `AppleWebKit/537.36 (KHTML, like Gecko)` tells the owner of the account
 * nothing they can decide on.
 *
 * Browser and platform names are left as they are written, because they are names. Only the word
 * joining them is translated. A device neither table can place is called unrecognised rather than
 * half-named, since a half-name here is worse than none: it invites a decision on a guess.
 */
export const describeDevice = (
  userAgent: string | null | undefined,
  locale: Locale,
): string => {
  const browser = userAgent ? firstMatch(BROWSERS, userAgent) : null;
  const platform = userAgent ? firstMatch(PLATFORMS, userAgent) : null;
  return browser && platform
    ? device_on({ browser, platform }, { locale })
    : devices_unknown({}, { locale });
};
