import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const src = () => path.resolve(import.meta.dirname, '..');

const COVERED_BY = {
  'features/operations/components/FeedbackForm.tsx':
    'features/operations/components/FeedbackForm.test.tsx',
};

const HELPER = 'visibleOptionMarkup';

const sources = (directory = src()): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return sources(absolute);
    return entry.endsWith('.tsx') && !entry.includes('.test.')
      ? [absolute]
      : [];
  });

/**
 * Every place the product hides the control a reader is meant to be choosing with.
 *
 * `type="file"` is excluded deliberately: a hidden file input behind a styled button is the
 * ordinary way to do that, and it has no selected state to render. A radio or a checkbox does, and
 * once its input is `sr-only` the only thing left saying which one is chosen is the styling around
 * it — which is a thing a component can simply forget to vary, with nothing failing. #79 was
 * exactly that.
 */
const hiddenSelectionControls = () =>
  sources().flatMap((absolute) => {
    const body = readFileSync(absolute, 'utf8');
    const tags = body.match(/<input\b[^>]*>/gu) ?? [];
    const found = tags.filter(
      (tag) =>
        tag.includes('sr-only') &&
        (tag.includes('type="radio"') || tag.includes('type="checkbox"')),
    );
    return found.length > 0
      ? [
          {
            file: path.relative(src(), absolute).split(path.sep).join('/'),
            count: found.length,
          },
        ]
      : [];
  });

describe('a chosen option looks chosen', () => {
  it('finds the source tree', () => {
    expect(
      sources().length,
      'no components were scanned, so everything below is vacuous',
    ).toBeGreaterThan(50);
  });

  it('has a test for every control that hides its own input', () => {
    const uncovered = hiddenSelectionControls()
      .filter(({ file }) => !(file in COVERED_BY))
      .map(
        ({ file }) =>
          `${file} hides a radio or checkbox behind sr-only, so only its styling says which option is chosen — add a test comparing two selections with ${HELPER}, and list it in COVERED_BY`,
      );

    expect(uncovered, uncovered.join('\n')).toEqual([]);
  });

  it('names a test that exists and actually makes the comparison', () => {
    for (const [source, test] of Object.entries(COVERED_BY)) {
      let body = '';
      try {
        body = readFileSync(path.join(src(), test), 'utf8');
      } catch {
        expect.fail(`${source} names ${test}, which does not exist`);
      }
      expect(
        body,
        `${test} is named as covering ${source} but never calls ${HELPER}, so nothing there compares what a reader can see`,
      ).toContain(HELPER);
    }
  });

  it('holds no entry for a control that no longer hides anything', () => {
    const live = new Set(hiddenSelectionControls().map(({ file }) => file));
    for (const source of Object.keys(COVERED_BY))
      expect(
        live.has(source),
        `${source} no longer hides a radio or checkbox — delete its entry`,
      ).toBe(true);
  });
});
