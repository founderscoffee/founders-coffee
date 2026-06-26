import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // ── Module-boundary contract (implementation-plan §5) ──
          // Every project is tagged with: type:app|lib, layer:ui|server|domain|data|shared, domain:<name>
          // Layers enforce the one-directional data flow:
          //   Component → hook → api → server-fn → domain → db → D1
          depConstraints: [
            // Apps may only depend on libraries (never sibling apps).
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
            // UI layer (components, hooks, api.ts, libs/ui) — NO server/domain/data.
            {
              sourceTag: 'layer:ui',
              onlyDependOnLibsWithTags: ['layer:ui', 'layer:shared'],
            },
            // Server layer (server functions) — domain + data + shared, never UI.
            {
              sourceTag: 'layer:server',
              onlyDependOnLibsWithTags: [
                'layer:server',
                'layer:domain',
                'layer:data',
                'layer:shared',
              ],
            },
            // Domain layer (pure logic) — domain + shared only (NO data/IO — keeps it pure).
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:shared'],
            },
            // Data layer (Drizzle/repositories) — data + shared only.
            {
              sourceTag: 'layer:data',
              onlyDependOnLibsWithTags: ['layer:data', 'layer:shared'],
            },
            // Shared layer (core/config/i18n) — shared only (lowest level).
            {
              sourceTag: 'layer:shared',
              onlyDependOnLibsWithTags: ['layer:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
