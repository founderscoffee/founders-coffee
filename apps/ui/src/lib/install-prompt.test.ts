import { afterEach, describe, expect, it } from 'vitest';

import {
  ENGAGED_AFTER_MS,
  RETURN_AFTER_MS,
  RETURN_SETTLE_MS,
  installCaptureScript,
  installPlatformFor,
  installPromptDueAt,
  takeCapturedInstallPrompt,
} from './install-prompt';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

const iphoneChrome = (os: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.101 Mobile/15E148 Safari/604.1`;

describe('which install sheet a browser is offered', () => {
  it.each([
    ['Chrome on an Android phone', ANDROID_CHROME, 'android'],
    ['Safari on an iPhone', IPHONE_SAFARI, 'ios'],
    [
      'Safari on an iPhone too old for other browsers to install',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1',
      'ios',
    ],
    ['Chrome on iOS 16.4, which added it', iphoneChrome('16_4'), 'ios'],
    ['Chrome on iOS 17', iphoneChrome('17_0'), 'ios'],
    ['Chrome on iOS 16.3, whose Share menu cannot', iphoneChrome('16_3'), null],
    [
      'Firefox on iOS 15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/114.0 Mobile/15E148 Safari/605.1.15',
      null,
    ],
    [
      'Instagram’s own browser on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85',
      null,
    ],
    [
      'Facebook’s own browser on Android',
      'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.109;]',
      null,
    ],
    [
      'the Google app on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/380.0.762871457 Mobile/15E148 Safari/604.1',
      null,
    ],
    [
      'a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      null,
    ],
    [
      'a Windows PC',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      null,
    ],
  ])('offers %s: %s', (_browser, userAgent, platform) => {
    expect(installPlatformFor(userAgent)).toBe(platform);
  });
});

describe('when the install sheet is due', () => {
  const START = 1_000_000_000;

  it('waits on a first visit until the reader has tapped something', () => {
    expect(
      installPromptDueAt({
        firstSeenAt: START,
        visitStartedAt: START,
        engagedAt: null,
      }),
    ).toBeNull();
  });

  it('opens twenty seconds into a first visit for a reader who tapped early', () => {
    expect(
      installPromptDueAt({
        firstSeenAt: START,
        visitStartedAt: START,
        engagedAt: START + 5_000,
      }),
    ).toBe(START + ENGAGED_AFTER_MS);
  });

  it('opens on the first tap once twenty seconds have passed', () => {
    expect(
      installPromptDueAt({
        firstSeenAt: START,
        visitStartedAt: START,
        engagedAt: START + 45_000,
      }),
    ).toBe(START + 45_000);
  });

  it('opens three seconds into a second visit, tap or not', () => {
    const visitStartedAt = START + RETURN_AFTER_MS;

    expect(
      installPromptDueAt({
        firstSeenAt: START,
        visitStartedAt,
        engagedAt: null,
      }),
    ).toBe(visitStartedAt + RETURN_SETTLE_MS);
  });

  it('treats a page reloaded within the half hour as the same first visit', () => {
    expect(
      installPromptDueAt({
        firstSeenAt: START,
        visitStartedAt: START + RETURN_AFTER_MS - 1,
        engagedAt: null,
      }),
      'a reload is not someone coming back, so it waits for a tap like the visit it continues',
    ).toBeNull();
  });
});

describe('the head script that holds Chrome’s install announcement', () => {
  afterEach(() => {
    takeCapturedInstallPrompt();
  });

  const runOn = (userAgent: string): EventTarget => {
    const page = new EventTarget();
    const run = new Function(
      'addEventListener',
      'navigator',
      installCaptureScript(),
    ) as (listen: EventTarget['addEventListener'], agent: object) => void;
    run(page.addEventListener.bind(page), { userAgent });
    return page;
  };

  const announce = (page: EventTarget): Event => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    page.dispatchEvent(event);
    return event;
  };

  it('holds the announcement on Android and keeps Chrome’s own banner away', () => {
    const event = announce(runOn(ANDROID_CHROME));

    expect(
      event.defaultPrevented,
      'an announcement left alone shows Chrome’s banner, a second offer beside the sheet',
    ).toBe(true);
    expect(takeCapturedInstallPrompt()).toBe(event);
  });

  it('hands the announcement over once', () => {
    announce(runOn(ANDROID_CHROME));
    takeCapturedInstallPrompt();

    expect(takeCapturedInstallPrompt()).toBeNull();
  });

  it('leaves a computer’s browser to its own install button', () => {
    const event = announce(
      runOn(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ),
    );

    expect(event.defaultPrevented).toBe(false);
    expect(takeCapturedInstallPrompt()).toBeNull();
  });
});
