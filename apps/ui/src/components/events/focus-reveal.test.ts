import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/u.test(entry) ? [path] : [];
  });

describe('controls that reveal themselves on focus', () => {
  it('never reaches for the sr-only pair a vendor sheet overrides', () => {
    const offenders = sourceFiles(srcRoot)
      .filter((path) => !path.endsWith('focus-reveal.test.ts'))
      .filter((path) =>
        /\bfocus:not-sr-only\b/u.test(readFileSync(path, 'utf8')),
      )
      .map((path) => path.slice(srcRoot.length + 1));

    expect(
      offenders,
      'timepicker-ui is imported unlayered and defines .sr-only, and an unlayered rule beats @layer utilities at any specificity, so focus:not-sr-only never fires and the control stays a 1x1 point while it holds focus. Use the .focus-reveal class instead',
    ).toEqual([]);
  });
});
