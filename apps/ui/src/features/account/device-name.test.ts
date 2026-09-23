import { describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { describeDevice } from './device-name';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  safariPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0',
  firefoxLinux:
    'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  firefoxPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/604.1',
};

describe('what a signed-in device is called', () => {
  it.each([
    [UA.chromeMac, 'Chrome on macOS'],
    [UA.safariMac, 'Safari on macOS'],
    [UA.safariPhone, 'Safari on iOS'],
    [UA.ipad, 'Safari on iPadOS'],
    [UA.chromeAndroid, 'Chrome on Android'],
    [UA.firefoxLinux, 'Firefox on Linux'],
  ])('reads %#', (userAgent, expected) => {
    expect(describeDevice(userAgent, 'en')).toBe(expected);
  });

  it('calls Edge Edge, though it says Chrome and Safari in the same breath', () => {
    expect(
      describeDevice(UA.edgeWindows, 'en'),
      'every Chromium browser carries Chrome and Safari in its string, so the more specific name has to be looked for first',
    ).toBe('Edge on Windows');
  });

  it('calls Firefox on a phone Firefox, not the Safari engine underneath it', () => {
    expect(describeDevice(UA.firefoxPhone, 'en')).toBe('Firefox on iOS');
  });

  it.each<[Locale, string]>([
    ['ar', 'Chrome على macOS'],
    ['en', 'Chrome on macOS'],
    ['fr', 'Chrome sur macOS'],
  ])('translates only the word joining them, in %s', (locale, expected) => {
    expect(
      describeDevice(UA.chromeMac, locale),
      'Chrome and macOS are names, and a name does not change language',
    ).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'curl/8.4.0',
    'Mozilla/5.0',
    'Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  ])('declines to half-name a device it cannot place: %s', (userAgent) => {
    expect(
      describeDevice(userAgent, 'en'),
      'a half-name on this page invites a decision on a guess, which is worse than no name',
    ).toBe('Unrecognised device');
  });
});
