import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import tsParser from '@typescript-eslint/parser';
import { ESLint, RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';

import { CONTROL_SIZES, daisyuiControlSize } from './daisyui-control-size.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../../..');

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const filename = '/repo/apps/ui/src/components/events/Field.tsx';

const jsx = (element) => `export const Field = ({ size }) => ${element};`;

const shared = (element) =>
  `import { Button, Input } from '@founders-coffee/ui';\n${jsx(element)}`;

const BUTTON = 'btn-xs sm:btn-sm md:btn-md lg:btn-lg';

const missing = (component, absent) => ({
  messageId: 'missing',
  data: {
    component,
    scale: CONTROL_SIZES.get(component).join(' '),
    missing: absent,
  },
});

const foreign = (component, token) => ({
  messageId: 'foreign',
  data: { component, scale: CONTROL_SIZES.get(component).join(' '), token },
});

const override = (component, token, what) => ({
  messageId: 'override',
  data: {
    component,
    scale: CONTROL_SIZES.get(component).join(' '),
    token,
    what,
  },
});

describe('local/daisyui-control-size', () => {
  it('holds every daisyUI control to its one size wherever a class list is written', () => {
    tester.run('daisyui-control-size', daisyuiControlSize, {
      valid: [
        {
          code: jsx(`<button className="btn btn-primary ${BUTTON} w-full" />`),
        },
        {
          code: jsx(
            `<a className="btn btn-ghost btn-square ${BUTTON} lg:hidden" />`,
          ),
        },
        {
          code: jsx(
            '<input className="input input-sm md:input-md w-full ps-11 pe-10" />',
          ),
        },
        {
          code: jsx(
            '<select className="select select-sm md:select-md flex-1" />',
          ),
        },
        {
          code: jsx(
            '<textarea className="textarea textarea-sm md:textarea-md w-1/2" />',
          ),
        },
        { code: jsx('<label className={`otp otp-sm md:otp-md ${size}`} />') },
        {
          name: 'each branch of a ternary is its own class list',
          code: jsx(
            `<button className={size ? 'btn btn-primary ${BUTTON}' : 'btn btn-ghost ${BUTTON}'} />`,
          ),
        },
        {
          name: 'a class chosen inside a template is not a size',
          code: jsx(
            `<button className={\`btn ${BUTTON} rounded-full \${size ? 'btn-success' : 'btn-secondary'}\`} />`,
          ),
        },
        {
          code: `const CTA_CLASS = 'btn btn-primary ${BUTTON} hidden sm:inline-flex';`,
        },
        {
          code: `export const button = cva('btn ${BUTTON}', { variants: { variant: { primary: 'btn-primary' } } });`,
        },
        {
          name: 'a colour, an alignment and a minimum width leave the size alone',
          code: jsx(
            `<button className="btn ${BUTTON} min-w-28 text-base-content text-center" />`,
          ),
        },
        {
          code: shared('<Button className="ms-auto min-w-28 font-semibold" />'),
        },
        { code: shared('<Input className="mt-4 w-full" />') },
        {
          name: 'a Button from anywhere but the design system is not a daisyUI control',
          code: `import { Button } from '@react-email/components';\n${jsx('<Button className="px-5 text-sm" />')}`,
        },
        { code: jsx('<div className="select-none" />') },
        { code: jsx('<span className="badge badge-sm" />') },
        {
          name: 'prose says input and select without being a class list',
          code: jsx(
            '<p title="btn input">{\'Select an input and a textarea\'}</p>',
          ),
        },
        {
          code: "export const prompt = 'Respond in the language of the input';",
        },
        {
          code: "export const listen = (field, size) => field.addEventListener('input', size);",
        },
      ].map((test) => ({ ...test, filename })),
      invalid: [
        {
          code: jsx('<button className="btn btn-primary" />'),
          errors: [missing('btn', BUTTON)],
        },
        {
          code: jsx('<button className="btn btn-sm" />'),
          errors: [missing('btn', BUTTON), foreign('btn', 'btn-sm')],
        },
        {
          code: jsx(
            `<button className="btn btn-primary ${BUTTON} xl:btn-xl" />`,
          ),
          errors: [foreign('btn', 'xl:btn-xl')],
        },
        {
          code: jsx(
            `<a className="btn btn-outline ${BUTTON} h-10 min-h-10 px-4 text-body-sm sm:px-4" />`,
          ),
          errors: [
            override('btn', 'h-10', 'a height'),
            override('btn', 'min-h-10', 'a height'),
            override('btn', 'px-4', 'padding'),
            override('btn', 'text-body-sm', 'a font size'),
            override('btn', 'sm:px-4', 'padding'),
          ],
        },
        {
          code: jsx(
            `<button className="btn btn-ghost btn-square ${BUTTON} size-9 md:w-48" />`,
          ),
          errors: [
            override('btn', 'size-9', 'a height and a width'),
            override('btn', 'md:w-48', 'a fixed width'),
          ],
        },
        {
          code: jsx('<input className="input h-12 w-full text-body" />'),
          errors: [
            missing('input', 'input-sm md:input-md'),
            override('input', 'h-12', 'a height'),
            override('input', 'text-body', 'a font size'),
          ],
        },
        {
          code: jsx(
            '<input className="input input-sm md:input-md w-24 lg:h-12" />',
          ),
          errors: [
            override('input', 'w-24', 'a fixed width'),
            override('input', 'lg:h-12', 'a height'),
          ],
        },
        {
          code: jsx('<select className="select select-lg" />'),
          errors: [
            missing('select', 'select-sm md:select-md'),
            foreign('select', 'select-lg'),
          ],
        },
        {
          code: jsx(
            '<textarea className="textarea textarea-sm md:textarea-md min-h-32" />',
          ),
          errors: [override('textarea', 'min-h-32', 'a height')],
        },
        {
          code: jsx('<label className={`otp otp-lg ${size}`} />'),
          errors: [
            missing('otp', 'otp-sm md:otp-md'),
            foreign('otp', 'otp-lg'),
          ],
        },
        {
          code: "const hostClass = 'btn btn-primary min-h-9';",
          errors: [
            missing('btn', BUTTON),
            override('btn', 'min-h-9', 'a height'),
          ],
        },
        {
          name: 'a shared component sizes its control, so its className may only add to it',
          code: shared('<Button className="h-11 px-5 text-base lg:h-12" />'),
          errors: [
            override('btn', 'h-11', 'a height'),
            override('btn', 'px-5', 'padding'),
            override('btn', 'text-base', 'a font size'),
            override('btn', 'lg:h-12', 'a height'),
          ],
        },
        {
          code: shared("<Button className={cn('btn-sm size-9', size)} />"),
          errors: [
            foreign('btn', 'btn-sm'),
            override('btn', 'size-9', 'a height and a width'),
          ],
        },
        {
          code: shared('<Input className="w-16" />'),
          errors: [override('input', 'w-16', 'a fixed width')],
        },
      ].map((test) => ({ ...test, filename })),
    });
  });
});

describe('the sizes local/daisyui-control-size holds controls to', () => {
  const daisyuiStylesheet = fs.readFileSync(
    require.resolve('daisyui/daisyui.css'),
    'utf8',
  );

  it('are all classes daisyUI styles', () => {
    const unstyled = [...CONTROL_SIZES.values()]
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
});
