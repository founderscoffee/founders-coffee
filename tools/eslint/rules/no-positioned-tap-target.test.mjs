import path from 'node:path';

import tsParser from '@typescript-eslint/parser';
import { ESLint, RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';

import { noPositionedTapTarget } from './no-positioned-tap-target.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../../..');

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const filename = '/repo/apps/ui/src/features/chat/components/ChatLog.tsx';

const jsx = (element) =>
  `export const Control = ({ isFloating, isWide }) => ${element};`;

const shared = (element) =>
  `import { Button, Input } from '@founders-coffee/ui';\n${jsx(element)}`;

const BUTTON = 'btn btn-neutral btn-xs sm:btn-sm md:btn-md';

const positioned = (token, target = 'btn') => ({
  messageId: 'positioned',
  data: { token, target },
});

describe('local/no-positioned-tap-target', () => {
  it('refuses a position written on a control whose touch hit area claims it', () => {
    tester.run('no-positioned-tap-target', noPositionedTapTarget, {
      valid: [
        {
          name: 'a wrapper takes the position and leaves the control alone',
          code: jsx(
            `<div className="absolute inset-x-0 bottom-3 mx-auto flex w-fit"><button className="${BUTTON} rounded-full" /></div>`,
          ),
        },
        {
          name: 'a control relative already anchors its own badge',
          code: jsx(
            `<button className={\`btn btn-secondary btn-xs sm:btn-sm md:btn-md relative \${isWide ? 'w-full' : 'w-fit'}\`}><span className="badge badge-xs absolute -end-2 -top-2" /></button>`,
          ),
        },
        {
          code: jsx(
            '<button className="tap-target flex size-6 items-center justify-center rounded-full" />',
          ),
        },
        { code: shared('<Input className="absolute end-2 top-2" />') },
        {
          name: 'a Button from anywhere but the design system is not a .btn',
          code: `import { Button } from '@react-email/components';\n${jsx('<Button className="absolute" />')}`,
        },
        {
          name: 'prose may say btn and absolute without being a class list',
          code: "export const hint = 'Pin the btn absolute in its corner';",
        },
      ].map((test) => ({ ...test, filename })),
      invalid: [
        {
          code: jsx(
            `<button className="${BUTTON} absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full" />`,
          ),
          errors: [positioned('absolute')],
        },
        {
          code: jsx(`<a className="${BUTTON} sticky top-0" />`),
          errors: [positioned('sticky')],
        },
        {
          name: 'a variant or an important mark still positions the control',
          code: jsx(`<button className="${BUTTON} md:fixed !absolute" />`),
          errors: [positioned('md:fixed'), positioned('!absolute')],
        },
        {
          code: jsx('<button className="tap-target absolute end-2 top-2" />'),
          errors: [positioned('absolute', 'tap-target')],
        },
        {
          name: 'a position chosen in one branch of a template meets the control named in another',
          code: jsx(
            `<button className={\`${BUTTON} \${isFloating ? 'absolute bottom-3' : ''}\`} />`,
          ),
          errors: [positioned('absolute')],
        },
        {
          code: jsx(
            `<button className={cn('${BUTTON}', isFloating && 'fixed bottom-4')} />`,
          ),
          errors: [positioned('fixed')],
        },
        {
          code: `const floatingButtonClass = '${BUTTON} sticky bottom-0';`,
          errors: [positioned('sticky')],
        },
        {
          name: 'the design system Button writes btn itself',
          code: shared('<Button className="absolute end-3 top-3" />'),
          errors: [positioned('absolute')],
        },
      ].map((test) => ({ ...test, filename })),
    });
  });
});

describe('local/no-positioned-tap-target in the workspace config', () => {
  const eslint = new ESLint({ cwd: rootDirectory });
  const severityFor = async (file) =>
    (await eslint.calculateConfigForFile(file)).rules[
      'local/no-positioned-tap-target'
    ]?.[0];

  it('covers the React sources and nothing else', async () => {
    for (const file of [
      'apps/ui/src/features/chat/components/ChatLog.tsx',
      'apps/ui/src/components/events/EventLocationMap.tsx',
      'apps/admin/src/features/shell/LocaleToggle.tsx',
      'libs/ui/src/components/Button.tsx',
    ]) {
      expect(await severityFor(file), file).toBe(2);
    }
    for (const file of [
      'libs/core/src/ai/summarize.ts',
      'tools/eslint/rules/no-positioned-tap-target.mjs',
    ]) {
      expect(await severityFor(file), file).toBeUndefined();
    }
  });
});
