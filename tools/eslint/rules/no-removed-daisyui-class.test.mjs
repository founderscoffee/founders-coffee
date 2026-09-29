import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import tsParser from '@typescript-eslint/parser';
import { ESLint, RuleTester } from 'eslint';
import { __unstable__loadDesignSystem } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import {
  REMOVED_DAISYUI_CLASSES,
  REMOVED_DAISYUI_MODIFIERS,
  noRemovedDaisyuiClass,
} from './no-removed-daisyui-class.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../../..');

const require = createRequire(import.meta.url);

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const filename = '/repo/apps/ui/src/components/events/Field.tsx';

const jsx = (element) => `export const Field = ({ size, side }) => ${element};`;

const removed = (name, fix) => ({ messageId: 'removed', data: { name, fix } });

const modifier = (component, name, replacement) => ({
  messageId: 'modifier',
  data: { component, modifier: name, replacement },
});

describe('local/no-removed-daisyui-class', () => {
  it('refuses a DaisyUI 4 class wherever a class list is written', () => {
    tester.run('no-removed-daisyui-class', noRemovedDaisyuiClass, {
      valid: [
        { code: jsx('<input className="input w-full" />') },
        {
          code: jsx('<div className="card card-border card-sm rounded-box" />'),
        },
        {
          code: jsx(
            '<div className="rounded-field rounded-s-selector md:rounded-t-box" />',
          ),
        },
        {
          code: "export const input = cva('input w-full', { variants: { size: { sm: 'input-sm' } } });",
        },
        { code: jsx('<p title="input-bordered-note">{size}</p>') },
        { code: jsx("<p>{'Pick a form control and a phone'}</p>") },
        { code: jsx('<span className="online" />') },
        { code: jsx('<div className="card-body compact" />') },
        { code: jsx('<div className="avatar placeholder:text-neutral" />') },
        {
          name: 'a class glued to a substitution is only part of one',
          code: jsx(
            '<div className={`${size}form-control rounded-${side}-btn`} />',
          ),
        },
        {
          name: 'a modifier counts only beside its component in the same string',
          code: jsx("<div className={cn('avatar', size && 'online')} />"),
        },
      ].map((test) => ({ ...test, filename })),
      invalid: [
        {
          code: jsx('<div className="form-control" />'),
          errors: [
            {
              message:
                '`form-control` is a DaisyUI 4 class that DaisyUI 5 does not have, so it styles nothing: write the column it was, `flex flex-col`, or group the field in a `fieldset`. (AGENTS.md §8)',
            },
          ],
        },
        {
          code: "export const PILL = 'rounded-btn border';",
          errors: [
            {
              message:
                '`rounded-btn` is a DaisyUI 4 class that DaisyUI 5 does not have, so it styles nothing: use `rounded-field`. (AGENTS.md §8)',
            },
          ],
        },
        {
          code: jsx('<div className="avatar online" />'),
          errors: [
            {
              message:
                '`online` beside `avatar` is a DaisyUI 4 modifier that DaisyUI 5 does not have, so it styles nothing: use `avatar-online`. (AGENTS.md §8)',
            },
          ],
        },
        {
          code: jsx('<input className="input input-bordered w-full" />'),
          errors: [
            removed(
              'input-bordered',
              'drop it: a DaisyUI 5 input has a border already, and `input-ghost` takes it away',
            ),
          ],
        },
        {
          code: "export const select = cva('select select-bordered w-full');",
          errors: [
            removed(
              'select-bordered',
              'drop it: a DaisyUI 5 select has a border already, and `select-ghost` takes it away',
            ),
          ],
        },
        {
          code: jsx(
            '<textarea className={`textarea ${size} textarea-bordered`} />',
          ),
          errors: [
            removed(
              'textarea-bordered',
              'drop it: a DaisyUI 5 textarea has a border already, and `textarea-ghost` takes it away',
            ),
          ],
        },
        {
          code: jsx('<div className={`${size} tabs-boxed ${side}`} />'),
          errors: [removed('tabs-boxed', 'use `tabs-box`')],
        },
        {
          code: jsx('<div className="md:rounded-s-badge" />'),
          errors: [removed('rounded-s-badge', 'use `rounded-s-selector`')],
        },
        {
          code: jsx('<div className="hover:!rounded-t-btn rounded-ee-btn!" />'),
          errors: [
            removed('rounded-t-btn', 'use `rounded-t-field`'),
            removed('rounded-ee-btn', 'use `rounded-ee-field`'),
          ],
        },
        {
          code: jsx('<div className="[&:hover]:card-compact" />'),
          errors: [removed('card-compact', 'use `card-sm`')],
        },
        {
          code: "export const hint = (isHint) => cn({ 'label-text-alt': isHint });",
          errors: [
            removed(
              'label-text-alt',
              'use `label`, or style the text with utilities',
            ),
          ],
        },
        {
          code: jsx('<nav className="btm-nav btm-nav-sm" />'),
          errors: [
            removed('btm-nav', 'use `dock`'),
            removed('btm-nav-sm', 'use `dock-sm`'),
          ],
        },
        {
          code: jsx('<div className="form-control md:form-control" />'),
          errors: [
            removed(
              'form-control',
              'write the column it was, `flex flex-col`, or group the field in a `fieldset`',
            ),
          ],
        },
        {
          code: jsx('<div className="card compact bordered" />'),
          errors: [
            modifier('card', 'compact', 'card-sm'),
            modifier('card', 'bordered', 'card-border'),
          ],
        },
        {
          code: jsx('<div className="avatar md:placeholder" />'),
          errors: [modifier('avatar', 'placeholder', 'avatar-placeholder')],
        },
      ].map((test) => ({ ...test, filename })),
    });
  });
});

/**
 * Tailwind's design system for Tailwind with DaisyUI 5 and nothing of this project's, loading an
 * `@import` by path or by Tailwind's own stylesheet and an `@plugin` by its package.
 */
const loadDesignSystem = () => {
  const resolveImport = (id, base) =>
    id.startsWith('.')
      ? path.resolve(base, id)
      : require.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
  return __unstable__loadDesignSystem(
    "@import 'tailwindcss';\n@plugin 'daisyui';",
    {
      base: rootDirectory,
      loadStylesheet: async (id, base) => {
        const file = resolveImport(id, base);
        const content = await fs.promises.readFile(file, 'utf8');
        return { path: file, base: path.dirname(file), content };
      },
      loadModule: async (id, base) => {
        const file = resolveImport(id, base);
        const { default: module } = await import(pathToFileURL(file).href);
        return { path: file, base: path.dirname(file), module };
      },
    },
  );
};

const design = await loadDesignSystem();

const daisyuiStylesheet = await fs.promises.readFile(
  require.resolve('daisyui/daisyui.css'),
  'utf8',
);

/**
 * Whether the build styles a class: Tailwind generates it, or DaisyUI 5 styles it inside a
 * component, as it does `dock-label` inside `dock`.
 */
const isStyled = (name) =>
  design.candidatesToCss([name])[0] !== null ||
  new RegExp(`\\.${name}(?![\\w-])`).test(daisyuiStylesheet);

describe('the classes local/no-removed-daisyui-class names', () => {
  it('names only classes the build does not style', () => {
    const modifiers = [...REMOVED_DAISYUI_MODIFIERS.values()].flatMap(
      (words) => [...words.keys()],
    );
    expect(
      [...REMOVED_DAISYUI_CLASSES.keys(), ...modifiers].filter(isStyled),
    ).toEqual([]);
  });

  it('points only at classes the build styles', () => {
    const named = [
      ...[...REMOVED_DAISYUI_CLASSES.values()].flatMap(
        ({ replacement, advice }) =>
          replacement
            ? [replacement]
            : [...advice.matchAll(/`([^`]+)`/g)].flatMap(([, code]) =>
                code.split(' '),
              ),
      ),
      ...[...REMOVED_DAISYUI_MODIFIERS].flatMap(([component, words]) => [
        component,
        ...words.values(),
      ]),
    ];
    expect(named).toEqual(
      expect.arrayContaining([
        'rounded-ee-selector',
        'dock-label',
        'input-ghost',
        'flex-col',
        'avatar-online',
      ]),
    );
    expect(named.filter((name) => !isStyled(name))).toEqual([]);
  });
});

describe('local/no-removed-daisyui-class in the workspace config', () => {
  const eslint = new ESLint({ cwd: rootDirectory });
  const severityFor = async (file) =>
    (await eslint.calculateConfigForFile(file)).rules[
      'local/no-removed-daisyui-class'
    ]?.[0];

  it('covers the React sources and nothing else', async () => {
    for (const file of [
      'apps/ui/src/features/preferences/components/NotificationChannelGrid.tsx',
      'apps/ui/src/components/events/EventDetail.test.tsx',
      'apps/admin/src/routes/__root.tsx',
      'apps/dashboard/src/routes/__root.tsx',
      'libs/ui/src/components/Input.tsx',
      'libs/ui/src/variants.test.ts',
    ]) {
      expect(await severityFor(file), file).toBe(2);
    }
    for (const file of [
      'apps/ui/e2e/create-event-field-layout.spec.ts',
      'libs/domain/src/index.ts',
      'tools/eslint/rules/no-removed-daisyui-class.mjs',
    ]) {
      expect(await severityFor(file), file).toBeUndefined();
    }
  });
});
