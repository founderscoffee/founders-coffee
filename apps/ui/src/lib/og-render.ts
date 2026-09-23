import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import satori, { init as initYoga } from 'satori/standalone';
import yogaWasm from 'satori/yoga.wasm';

import arabicRegular from '@fontsource/tajawal/files/tajawal-arabic-400-normal.woff?inline';
import arabicBold from '@fontsource/tajawal/files/tajawal-arabic-700-normal.woff?inline';
import latinRegular from '@fontsource/tajawal/files/tajawal-latin-400-normal.woff?inline';
import latinBold from '@fontsource/tajawal/files/tajawal-latin-700-normal.woff?inline';

import type { CardNode } from './og-card';

const decode = (dataUrl: string): ArrayBuffer => {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

/**
 * Tajawal, in the two weights the card uses, as four faces rather than two.
 *
 * `@fontsource/tajawal` ships its Arabic and Latin coverage as separate subset files, and the
 * Arabic one has no digits, no `·` and no Latin letters at all. Registering only it renders every
 * one of those as tofu: the first French card this produced was a row of empty boxes, and the
 * Arabic date line lost its `25`. They are two families here because satori falls back per family,
 * so a glyph missing from the first is looked for in the second.
 */
const cardFonts = () => [
  { name: 'Tajawal', data: decode(arabicBold), weight: 700, style: 'normal' },
  {
    name: 'Tajawal',
    data: decode(arabicRegular),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'TajawalLatin',
    data: decode(latinBold),
    weight: 700,
    style: 'normal',
  },
  {
    name: 'TajawalLatin',
    data: decode(latinRegular),
    weight: 400,
    style: 'normal',
  },
];

let ready: Promise<unknown> | null = null;

/**
 * Bring up both WebAssembly modules, once per isolate.
 *
 * The promise is kept rather than the result, because two requests arriving together on a cold
 * isolate would otherwise both start initialising, and the second `initWasm` throws for being
 * called twice.
 *
 * Satori's standalone build is the one that leaves Yoga out; the default build carries it as a
 * base64 string and compiles it from those bytes, which a Worker refuses. Both modules arrive here
 * already compiled, which is the only form a Worker accepts.
 */
const wasmReady = (): Promise<unknown> =>
  (ready ??= Promise.all([
    initYoga(yogaWasm as WebAssembly.Module),
    initWasm(resvgWasm as WebAssembly.Module),
  ]));

/** Draw a card and rasterise it to PNG. */
export const renderCardPng = async (tree: CardNode): Promise<Uint8Array> => {
  await wasmReady();
  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: cardFonts() as Parameters<typeof satori>[1]['fonts'],
  });
  return new Resvg(svg).render().asPng();
};
