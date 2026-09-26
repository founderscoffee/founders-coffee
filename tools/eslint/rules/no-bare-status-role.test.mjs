import fs from 'node:fs';
import path from 'node:path';

import tsParser from '@typescript-eslint/parser';
import { ESLint, RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';

import { STATUS_COMPONENTS } from '../file-globs.mjs';
import { noBareStatusRole } from './no-bare-status-role.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../../..');

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const filename = '/repo/apps/ui/src/components/events/Notice.tsx';

const jsx = (element, preamble = '') =>
  `${preamble}export const Notice = ({ isError, isOpen, label }) => ${element};`;

const bare = (role) => ({ messageId: 'bare', data: { role } });

describe('local/no-bare-status-role', () => {
  it('refuses a status or alert role however its value is spelled', () => {
    tester.run('no-bare-status-role', noBareStatusRole, {
      valid: [
        { code: jsx('<StatusMessage variant="error">{label}</StatusMessage>') },
        { code: jsx('<LoadingStatus label={label} />') },
        { code: jsx('<div role="alertdialog" aria-modal="true" />') },
        { code: jsx('<div role="dialog" />') },
        { code: jsx('<ul role="listbox" />') },
        { code: jsx('<div role={label} />') },
        { code: jsx('<div role={roleFor(label)} />') },
        { code: jsx('<div role={`${label}`} />') },
        { code: jsx('<div aria-live="polite">{label}</div>') },
        { code: jsx('<div data-role="status" />') },
        { code: jsx('<div role={kind} />', "let kind = 'status';\n") },
        {
          name: 'a substitution can finish the word, as alertdialog',
          code: jsx('<div role={`alert${label}`} />'),
        },
        {
          name: 'a destructured binding holds a part of its initialiser',
          code: jsx('<div role={first} />', "const [first] = 'status';\n"),
        },
        {
          code: "export const PERMISSION = { role: 'status', status: 'alert' };",
        },
      ].map((test) => ({ ...test, filename })),
      invalid: [
        { code: jsx('<p role="status">{label}</p>'), errors: [bare('status')] },
        { code: jsx('<p role="alert">{label}</p>'), errors: [bare('alert')] },
        { code: jsx("<p role={'alert'}>{label}</p>"), errors: [bare('alert')] },
        {
          code: jsx('<p role={`status`}>{label}</p>'),
          errors: [bare('status')],
        },
        {
          code: jsx('<p role="Status">{label}</p>'),
          errors: [bare('status')],
        },
        {
          code: jsx('<p role="presentation status">{label}</p>'),
          errors: [bare('status')],
        },
        {
          code: jsx("<p role={isError ? 'alert' : 'status'}>{label}</p>"),
          errors: [bare('alert or status')],
        },
        {
          code: jsx("<p role={isError ? 'alert' : undefined}>{label}</p>"),
          errors: [bare('alert')],
        },
        {
          code: jsx("<p role={isOpen && 'status'}>{label}</p>"),
          errors: [bare('status')],
        },
        {
          code: jsx("<p role={label ?? 'status'}>{label}</p>"),
          errors: [bare('status')],
        },
        {
          code: jsx("<p role={'alert' as const}>{label}</p>"),
          errors: [bare('alert')],
        },
        {
          code: jsx("<p role={'status' satisfies AriaRole}>{label}</p>"),
          errors: [bare('status')],
        },
        {
          code: jsx('<p role={ROLE}>{label}</p>', "const ROLE = 'alert';\n"),
          errors: [bare('alert')],
        },
        {
          code: jsx(
            '<p role={role}>{label}</p>',
            "const LIVE = 'status';\nconst role = LIVE;\n",
          ),
          errors: [bare('status')],
        },
        {
          code: jsx('<Box role="status">{label}</Box>'),
          errors: [bare('status')],
        },
        {
          code: jsx('<motion.div role="alert">{label}</motion.div>'),
          errors: [bare('alert')],
        },
      ].map((test) => ({ ...test, filename })),
    });
  });

  it('does not loop on constants that name each other', () => {
    tester.run('no-bare-status-role', noBareStatusRole, {
      valid: [
        {
          code: jsx(
            '<p role={first}>{label}</p>',
            'const first = second;\nconst second = first;\n',
          ),
          filename,
        },
      ],
      invalid: [],
    });
  });
});

describe('local/no-bare-status-role in the workspace config', () => {
  const eslint = new ESLint({ cwd: rootDirectory });
  const severityFor = async (file) =>
    (await eslint.calculateConfigForFile(file)).rules[
      'local/no-bare-status-role'
    ]?.[0];

  it('exempts the shared status components and nothing else', async () => {
    for (const file of STATUS_COMPONENTS) {
      expect(
        fs.existsSync(path.join(rootDirectory, file)),
        `${file} is exempt, but there is no such file`,
      ).toBe(true);
      expect(await severityFor(file), file).toBe(0);
    }
    for (const file of [
      'apps/ui/src/components/events/EventDetail.tsx',
      'apps/ui/src/features/operations/components/FeedbackPage.tsx',
      'apps/ui/src/components/events/EventDetail.test.tsx',
      'apps/admin/src/routes/__root.tsx',
      'libs/ui/src/components/Button.tsx',
      'libs/ui/src/components/StatusIcon.tsx',
    ]) {
      expect(await severityFor(file), file).toBe(2);
    }
  });
});
