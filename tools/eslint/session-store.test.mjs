import path from 'node:path';

import tsParser from '@typescript-eslint/parser';
import { ESLint, Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

const rootDirectory = path.resolve(import.meta.dirname, '../..');
const eslint = new ESLint({ cwd: rootDirectory });

const restrictedPropertiesAt = async (file) =>
  (await eslint.calculateConfigForFile(path.join(rootDirectory, file)))
    ?.rules?.['no-restricted-properties'];

const lint = (code, setting) =>
  new Linter().verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser },
        rules: { 'no-restricted-properties': setting },
      },
    ],
    'probe.ts',
  );

describe('reading the session store in a render', () => {
  it.each([
    'apps/ui/src/features/events/hooks.ts',
    'apps/ui/src/features/events/components/ActivityPage.tsx',
    'apps/ui/src/components/shell/SessionNav.tsx',
    'apps/ui/src/routes/$locale.probe.tsx',
  ])(
    'is refused in %s, pointing at the hooks that wait for hydration',
    async (file) => {
      const setting = await restrictedPropertiesAt(file);

      expect(
        lint('const auth = authClient.useSession();', setting),
      ).toMatchObject([
        {
          ruleId: 'no-restricted-properties',
          severity: 2,
          line: 1,
          message: expect.stringContaining(
            'useAuth() or useHydrationSafeSession()',
          ),
        },
      ]);
    },
  );

  it('is left to the hook that holds the session back until hydration has committed', async () => {
    const setting = await restrictedPropertiesAt(
      'apps/ui/src/lib/hydration-safe-session.ts',
    );

    expect(lint('const session = authClient.useSession();', setting)).toEqual(
      [],
    );
  });

  it('leaves the client’s other calls alone', async () => {
    const setting = await restrictedPropertiesAt(
      'apps/ui/src/components/shell/SessionNav.tsx',
    );

    expect(lint('void authClient.signOut();', setting)).toEqual([]);
  });
});
