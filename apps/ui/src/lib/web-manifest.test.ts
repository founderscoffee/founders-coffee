import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { direction, locales, type Locale } from '@founders-coffee/i18n';

import { manifestHref, manifestHrefs } from './web-manifest';

type ImageResource = {
  readonly src: string;
  readonly sizes?: string;
  readonly type?: string;
  readonly purpose?: string;
  readonly form_factor?: string;
  readonly label?: string;
};

type Shortcut = { readonly name: string; readonly url: string };

type WebManifest = {
  readonly id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly lang: string;
  readonly dir: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: string;
  readonly orientation: string;
  readonly theme_color: string;
  readonly background_color: string;
  readonly categories: readonly string[];
  readonly icons: readonly ImageResource[];
  readonly screenshots: readonly ImageResource[];
  readonly shortcuts: readonly Shortcut[];
};

const PUBLIC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../public',
);

/**
 * A path under `public/`, which is what Workers Assets serves at the site root.
 *
 * Built with `node:path` rather than `new URL`: under the jsdom environment `URL` is jsdom's, and
 * `fileURLToPath` reads one of those as the string `undefined`.
 */
const publicFile = (path: string): string => join(PUBLIC_DIR, path);

const readManifest = (locale: Locale): WebManifest =>
  JSON.parse(
    readFileSync(publicFile(manifestHref(locale)), 'utf-8'),
  ) as WebManifest;

const MANIFESTS = locales.map((locale): [Locale, WebManifest] => [
  locale,
  readManifest(locale),
]);

/** Width and height a PNG declares in its IHDR chunk, which starts at byte 16. */
const pngSize = (path: string): string => {
  const bytes = new Uint8Array(readFileSync(path));
  const header = new DataView(bytes.buffer);
  return `${header.getUint32(16)}x${header.getUint32(20)}`;
};

const everyImage = (manifest: WebManifest): readonly ImageResource[] => [
  ...manifest.icons,
  ...manifest.screenshots,
];

/** The fields that make two manifests the same installed app rather than two. */
const identity = (manifest: WebManifest) => ({
  id: manifest.id,
  name: manifest.name,
  short_name: manifest.short_name,
  start_url: manifest.start_url,
  scope: manifest.scope,
  display: manifest.display,
  orientation: manifest.orientation,
  theme_color: manifest.theme_color,
  background_color: manifest.background_color,
  categories: manifest.categories,
  icons: manifest.icons,
});

describe('web app manifest', () => {
  it('ships one manifest per locale', () => {
    expect(MANIFESTS).toHaveLength(locales.length);
    expect(manifestHrefs()).toContain('/manifest.json');
    for (const href of manifestHrefs()) {
      expect(existsSync(publicFile(href)), `${href} is not in public/`).toBe(
        true,
      );
    }
  });

  it('declares one install identity across all of them', () => {
    const [, first] = MANIFESTS[0];
    for (const [locale, manifest] of MANIFESTS) {
      expect(
        identity(manifest),
        `${locale} drifted from the shared identity`,
      ).toEqual(identity(first));
    }
    expect(first.id).toBe('/');
  });

  it('writes each manifest in its own locale', () => {
    for (const [locale, manifest] of MANIFESTS) {
      expect(manifest.lang).toBe(locale);
      expect(manifest.dir).toBe(direction(locale));
      expect(manifest.description.length).toBeGreaterThan(20);
      expect(manifest.screenshots[0]?.label ?? '').not.toBe('');
      expect(manifest.shortcuts.length).toBeGreaterThan(0);
    }
    const descriptions = new Set(
      MANIFESTS.map(([, manifest]) => manifest.description),
    );
    expect(descriptions.size).toBe(locales.length);
  });

  it('points every image at a file the build serves, at the size it claims', () => {
    for (const [locale, manifest] of MANIFESTS) {
      for (const image of everyImage(manifest)) {
        const path = publicFile(image.src);
        expect(existsSync(path), `${locale}: ${image.src} is missing`).toBe(
          true,
        );
        expect(
          pngSize(path),
          `${locale}: ${image.src} is not ${image.sizes}`,
        ).toBe(image.sizes);
      }
    }
  });

  it('gives Android a narrow screenshot and a maskable icon', () => {
    for (const [locale, manifest] of MANIFESTS) {
      expect(
        manifest.screenshots.some((shot) => shot.form_factor === 'narrow'),
        `${locale} has no narrow screenshot`,
      ).toBe(true);
      expect(
        manifest.icons.some((icon) => icon.purpose === 'maskable'),
        `${locale} has no maskable icon`,
      ).toBe(true);
    }
  });

  it('keeps every url same-origin and inside the scope', () => {
    for (const [locale, manifest] of MANIFESTS) {
      const urls = [
        manifest.start_url,
        ...manifest.shortcuts.map((shortcut) => shortcut.url),
        ...everyImage(manifest).map((image) => image.src),
      ];
      for (const url of urls) {
        expect(
          url.startsWith('/'),
          `${locale}: ${url} is not root-relative`,
        ).toBe(true);
        expect(
          url.startsWith('//'),
          `${locale}: ${url} is protocol-relative`,
        ).toBe(false);
      }
    }
  });

  it('keeps em dashes out of the manifests and the offline page', () => {
    for (const href of manifestHrefs()) {
      expect(readFileSync(publicFile(href), 'utf-8'), `${href}`).not.toMatch(
        /—/,
      );
    }
    expect(
      readFileSync(publicFile('/offline.html'), 'utf-8'),
      'offline.html',
    ).not.toMatch(/—/);
  });
});
