import { describe, expect, it } from 'vitest';

import { directionsUrl, mapsAppFor } from './directions';

const ALGIERS = { latitude: 36.7538, longitude: 3.0588 };

describe('mapsAppFor', () => {
  it.each([
    [
      'an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      'apple',
    ],
    [
      'an iPad',
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'apple',
    ],
    [
      'an iPad web view that calls itself a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'apple',
    ],
    [
      'an Android phone',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      'google',
    ],
    [
      'a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      'google',
    ],
    [
      'a Windows PC',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'google',
    ],
  ])('gives %s %s', (_device, userAgent, app) => {
    expect(mapsAppFor(userAgent)).toBe(app);
  });
});

describe('directionsUrl', () => {
  it('asks Google Maps for directions to the point the host placed', () => {
    expect(directionsUrl('google', ALGIERS)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=36.7538%2C3.0588',
    );
  });

  it('asks Apple Maps for directions to the same point', () => {
    expect(directionsUrl('apple', ALGIERS)).toBe(
      'https://maps.apple.com/?daddr=36.7538%2C3.0588',
    );
  });

  it('writes the point to six decimals, about ten centimetres', () => {
    expect(
      directionsUrl('google', {
        latitude: 36.75384615384615,
        longitude: 3.058823529411765,
      }),
    ).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=36.753846%2C3.058824',
    );
  });
});
