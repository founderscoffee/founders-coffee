import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The opening `<dialog …>` tag beginning at `start`, read brace-aware.
 *
 * A naive `[^>]*>` stops at the first `>` it meets, which in JSX is usually the arrow of an
 * `onKeyDown={(event) => …}` prop rather than the end of the tag. Counting braces walks past every
 * expression attribute and ends on the `>` that actually closes the tag.
 */
const openingTag = (source: string, start: number): string => {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
};

export type DeclaredDialog = {
  readonly file: string;
  readonly tag: string;
  readonly source: string;
};

/**
 * Every `<dialog>` the app renders, as the opening tag it was written as.
 *
 * Read as source rather than rendered. Mounting all six would mean standing up each one's props,
 * router and session mocks to answer a question the markup already answers, and a scan meets the
 * seventh dialog on the day it is added rather than on the day somebody writes it a test.
 */
export const declaredDialogs = (): DeclaredDialog[] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
    .flatMap((name) => {
      const source = readFileSync(join(SRC, name), 'utf8');
      return [...source.matchAll(/<dialog\b/gu)].map((match) => ({
        file: name,
        tag: openingTag(source, match.index),
        source,
      }));
    });
