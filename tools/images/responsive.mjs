/**
 * Regenerate the narrow variants of the how-it-works illustrations.
 *
 * Run manually after replacing any of the sources: `node tools/images/responsive.mjs`.
 *
 * The widths are not round numbers picked for tidiness, they are the slot the image actually
 * occupies multiplied by the pixel ratios that ask for it. The card is `w-24` — 96px — until the
 * grid becomes three columns at 640px, and from there it is a third of the content container less
 * its padding and gaps, which caps at 336px once the container hits its 70rem maximum. So 192 is
 * the phone at 2x, 384 covers the phone at 3x and the narrow end of the three-column range, and
 * 672 is the widest slot at 2x. The 1254px source stays as the last candidate for 3x desktop.
 *
 * Quality is deliberately higher on the small variants than the source needed: these are line
 * drawings on a flat ground, and webp's default effort smears thin strokes at small sizes far more
 * visibly than it does at 1254px, where there are pixels to spare.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = `${ROOT}/apps/ui/public/images`;
const WIDTHS = [192, 384, 672];
const SOURCE = /^how-step\d+\.webp$/;

const kb = (path) => `${(statSync(path).size / 1024).toFixed(1)} KB`;

const sources = readdirSync(DIR)
  .filter((name) => SOURCE.test(name))
  .sort();

if (sources.length === 0) throw new Error(`no how-step*.webp under ${DIR}`);

for (const name of sources) {
  const from = `${DIR}/${name}`;
  const stem = name.replace(/\.webp$/, '');
  console.log(`${name}  ${kb(from)}  (source)`);
  for (const width of WIDTHS) {
    const to = `${DIR}/${stem}-${width}.webp`;
    await sharp(from)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(to);
    console.log(`  -> ${stem}-${width}.webp  ${kb(to)}`);
  }
}
