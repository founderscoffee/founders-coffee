import path from 'node:path';

import tsParser from '@typescript-eslint/parser';
import { ESLint, Linter } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { describe, expect, it } from 'vitest';

const rootDirectory = path.resolve(import.meta.dirname, '../..');
const eslint = new ESLint({ cwd: rootDirectory });

const rulesOfHooksAt = async (file) =>
  (await eslint.calculateConfigForFile(path.join(rootDirectory, file)))
    ?.rules?.['react-hooks/rules-of-hooks'];

const lintComponent = (code, severity) =>
  new Linter().verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { 'react-hooks': reactHooks },
        rules: { 'react-hooks/rules-of-hooks': severity },
      },
    ],
    'Probe.tsx',
  );

describe('the rules of hooks (#93)', () => {
  it.each([
    'apps/ui/src/components/shell/Probe.tsx',
    'apps/ui/src/features/events/hooks.ts',
    'apps/ui/src/routes/$locale.probe.tsx',
    'apps/admin/src/features/auth/Probe.tsx',
    'apps/dashboard/src/routes/probe.tsx',
    'libs/ui/src/components/Probe.tsx',
    'libs/email/src/templates/Probe.tsx',
  ])('are an error in %s', async (file) => {
    expect(await rulesOfHooksAt(file)).toEqual([2]);
  });

  it.each(['apps/ui/e2e/support/probe.ts', 'libs/server-fns/src/probe.ts'])(
    'stay out of %s, which React never calls',
    async (file) => {
      expect(await rulesOfHooksAt(file)).toBeUndefined();
    },
  );

  it('refuse a hook an arrow-function component calls only after an early return', async () => {
    const severity = await rulesOfHooksAt(
      'apps/ui/src/components/shell/Probe.tsx',
    );

    const messages = lintComponent(
      [
        'const Presence = ({ isSignedIn }: { isSignedIn: boolean }) => {',
        '  if (!isSignedIn) return null;',
        '  const presence = useLivePresence();',
        '  return <p>{presence}</p>;',
        '};',
      ].join('\n'),
      severity,
    );

    expect(messages).toMatchObject([
      { ruleId: 'react-hooks/rules-of-hooks', severity: 2, line: 3 },
    ]);
  });

  it('let the same hook through once it is called before the return', async () => {
    const severity = await rulesOfHooksAt(
      'apps/ui/src/components/shell/Probe.tsx',
    );

    const messages = lintComponent(
      [
        'const Presence = ({ isSignedIn }: { isSignedIn: boolean }) => {',
        '  const presence = useLivePresence();',
        '  if (!isSignedIn) return null;',
        '  return <p>{presence}</p>;',
        '};',
      ].join('\n'),
      severity,
    );

    expect(messages).toEqual([]);
  });
});
