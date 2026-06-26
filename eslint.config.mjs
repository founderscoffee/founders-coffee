import nx from '@nx/eslint-plugin';

/**
 * Local rule: ban `//` line comments (AGENTS.md §5 — no inline comments).
 * JSDoc and plain block comments are allowed; toolchain directive comments
 * (eslint- / @ts- / prettier- / istanbul) are exempt so the toolchain keeps working.
 */
const noLineComments = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      noLine:
        'No `//` line comments — use JSDoc `/** */` for documentation (AGENTS.md §5). Directive comments (eslint-/@ts-) are allowed.',
    },
  },
  create: (context) => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const isDirective = (value) =>
      /^\s*(eslint-(disable|enable)(-(next-)?line)?|@ts-|globals?\s|@internal|istanbul |prettier-)/.test(
        value,
      );
    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === 'Line' && !isDirective(comment.value)) {
            context.report({ node: comment, messageId: 'noLine' });
          }
        }
      },
    };
  },
};

const localPlugin = {
  meta: { name: 'founders-coffee-local', version: '1.0.0' },
  rules: { 'no-line-comments': noLineComments },
};

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
          /* ── Module-boundary contract (implementation-plan §5) ──
             Every project is tagged: type:app|lib, layer:ui|server|domain|data|shared, domain:<name>.
             Layers enforce the one-directional data flow:
               Component → hook → api → server-fn → domain → db → D1 */
          depConstraints: [
            /* Apps may only depend on libraries (never sibling apps). */
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
            /* UI layer (components, hooks, api.ts, libs/ui) — NO server/domain/data. */
            {
              sourceTag: 'layer:ui',
              onlyDependOnLibsWithTags: ['layer:ui', 'layer:shared'],
            },
            /* Server layer (server functions) — domain + data + shared, never UI. */
            {
              sourceTag: 'layer:server',
              onlyDependOnLibsWithTags: [
                'layer:server',
                'layer:domain',
                'layer:data',
                'layer:shared',
              ],
            },
            /* Domain layer (pure logic) — domain + shared only (NO data/IO — keeps it pure). */
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:shared'],
            },
            /* Data layer (Drizzle/repositories) — data + shared only. */
            {
              sourceTag: 'layer:data',
              onlyDependOnLibsWithTags: ['layer:data', 'layer:shared'],
            },
            /* Shared layer (core/config/i18n) — shared only (lowest level). */
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
    plugins: { local: localPlugin },
    rules: {
      /* Arrow functions only (AGENTS.md §5) — generators & class constructors excepted. */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration:not([generator=true])',
          message:
            'Use an arrow function (`const f = () => …`). (AGENTS.md §5 — arrow functions only; generators excepted.)',
        },
        {
          selector:
            "FunctionExpression:not([generator=true]):not(MethodDefinition[kind='constructor'] > FunctionExpression)",
          message:
            'Use an arrow function — object/class methods as arrow fields. (AGENTS.md §5 — constructors & generators excepted.)',
        },
      ],
      'local/no-line-comments': 'error',
    },
  },
];
