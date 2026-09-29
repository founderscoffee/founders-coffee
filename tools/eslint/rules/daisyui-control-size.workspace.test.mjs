import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import {
  CALL_TO_ACTION_SIZES,
  CONTROL_SIZES,
} from './daisyui-control-size.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../../..');

const require = createRequire(import.meta.url);

describe('the sizes local/daisyui-control-size holds controls to', () => {
  const daisyuiStylesheet = fs.readFileSync(
    require.resolve('daisyui/daisyui.css'),
    'utf8',
  );

  it('are all classes daisyUI styles', () => {
    const unstyled = [
      ...CONTROL_SIZES.values(),
      ...CALL_TO_ACTION_SIZES.values(),
    ]
      .flat()
      .map((size) => size.replace(/^\w+:/, ''))
      .filter(
        (name) => !new RegExp(`\\.${name}(?![\\w-])`).test(daisyuiStylesheet),
      );
    expect(unstyled).toEqual([]);
  });
});

describe('local/daisyui-control-size in the workspace config', () => {
  const eslint = new ESLint({ cwd: rootDirectory });
  const severityFor = async (file) =>
    (await eslint.calculateConfigForFile(file)).rules[
      'local/daisyui-control-size'
    ]?.[0];

  it('covers the React sources and nothing else', async () => {
    for (const file of [
      'apps/ui/src/components/events/EventCard.tsx',
      'apps/admin/src/features/shell/LocaleToggle.tsx',
      'libs/ui/src/components/Button.tsx',
    ]) {
      expect(await severityFor(file), file).toBe(2);
    }
    for (const file of [
      'libs/core/src/ai/summarize.ts',
      'tools/eslint/rules/daisyui-control-size.mjs',
    ]) {
      expect(await severityFor(file), file).toBeUndefined();
    }
  });

  it("takes only the landing's calls to action on to lg", async () => {
    const optionsFor = async (file) =>
      (await eslint.calculateConfigForFile(file)).rules[
        'local/daisyui-control-size'
      ]?.[1];
    for (const file of [
      'apps/ui/src/components/landing/MarketHero.tsx',
      'apps/ui/src/components/landing/HowItWorks.tsx',
    ]) {
      expect(await optionsFor(file), file).toEqual({
        buttons: 'call-to-action',
      });
    }
    for (const file of [
      'apps/ui/src/components/shell/Navbar.tsx',
      'apps/ui/src/components/landing/CityLanding.tsx',
      'libs/ui/src/components/Button.tsx',
    ]) {
      expect(await optionsFor(file), file).toBeUndefined();
    }
  });
});
