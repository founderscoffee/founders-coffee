import { describe, expect, it } from 'vitest';

import { staticMapPicture, staticMapUrl } from './static-map';

const ALGIERS = { latitude: 36.7538, longitude: 3.0588 };

const boxOf = (url: string): string | undefined =>
  /\/(\d+x\d+(?:@2x)?)\?/u.exec(url)?.[1];

describe('staticMapUrl', () => {
  it('asks Mapbox for the point as longitude then latitude, at the zoom the live map drew', () => {
    expect(
      staticMapUrl(ALGIERS, { width: 400, height: 224 }, 1, 'pk.test'),
    ).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/3.0588,36.7538,14.5/400x224?attribution=false&logo=false&access_token=pk.test',
    );
  });

  it('asks Mapbox to leave off the logo and credits it would print where the page crops', () => {
    const url = new URL(
      staticMapUrl(ALGIERS, { width: 400, height: 224 }, 2, 'pk.test'),
    );

    expect(url.searchParams.get('attribution')).toBe('false');
    expect(url.searchParams.get('logo')).toBe('false');
  });

  it('asks for twice the pixels for a sharp screen', () => {
    expect(
      boxOf(staticMapUrl(ALGIERS, { width: 400, height: 224 }, 2, 'pk.test')),
    ).toBe('400x224@2x');
  });

  it('writes a coordinate to six decimals, about ten centimetres', () => {
    expect(
      staticMapUrl(
        { latitude: 36.75384615384615, longitude: 3.058823529411765 },
        { width: 400, height: 224 },
        1,
        'pk.test',
      ),
    ).toContain('/static/3.058824,36.753846,14.5/');
  });

  it('escapes the token', () => {
    expect(
      staticMapUrl(ALGIERS, { width: 400, height: 224 }, 1, 'pk.a/b+c'),
    ).toMatch(/[?&]access_token=pk\.a%2Fb%2Bc$/u);
  });
});

describe('staticMapPicture', () => {
  it('gives each screen a picture as tall as the map is there, from the widest screen down', () => {
    const picture = staticMapPicture(ALGIERS, 'pk.test');

    expect(
      picture.sources.map(({ media, srcSet }) => [
        media,
        srcSet.split(', ').map((candidate) => {
          const [url = '', density] = candidate.split(' ');
          return `${boxOf(url)} ${density}`;
        }),
      ]),
    ).toEqual([
      ['(min-width: 64rem)', ['960x288 1x', '960x288@2x 2x']],
      ['(min-width: 48rem)', ['960x256 1x', '960x256@2x 2x']],
      ['(min-width: 40rem)', ['736x256 1x', '736x256@2x 2x']],
      ['(min-width: 27rem)', ['608x224 1x', '608x224@2x 2x']],
    ]);
  });

  it("falls back to a phone's picture, sharp where the browser reads no srcset", () => {
    const picture = staticMapPicture(ALGIERS, 'pk.test');

    expect(boxOf(picture.src)).toBe('400x224@2x');
    expect(picture.srcSet).toBe(
      `${staticMapUrl(ALGIERS, { width: 400, height: 224 }, 1, 'pk.test')} 1x, ${picture.src} 2x`,
    );
  });
});
