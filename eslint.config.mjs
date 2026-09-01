import nx from '@nx/eslint-plugin';

/**
 * Toolchain directives are exempt from every comment rule below — without them `eslint-disable`,
 * `@ts-expect-error` and TypeScript `/// <reference />` could not be written at all.
 */
const isDirectiveComment = (value) =>
  /^\s*(eslint-(disable|enable)(-(next-)?line)?|@ts-|\/\s*<reference|globals?\s|@internal|istanbul |prettier-)/.test(
    value,
  );

/**
 * Local rule: ban `//` line comments outside TypeScript (AGENTS.md §5). TypeScript files are held
 * to the stricter `comment-policy` rule instead, so the two never both fire on one comment.
 */
const noLineComments = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      noLine:
        'No `//` line comments — use a block comment for documentation (AGENTS.md §5). Directive comments (eslint-/@ts-) are allowed.',
    },
  },
  create: (context) => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === 'Line' && !isDirectiveComment(comment.value)) {
            context.report({ node: comment, messageId: 'noLine' });
          }
        }
      },
    };
  },
};

/**
 * Local rule: the TypeScript comment policy (AGENTS.md §5).
 *
 * `.tsx` carries no comments at all — markup and component names are the documentation.
 * `.ts` carries only JSDoc (`/** *\/`) documenting a function; file headers, narrative block
 * comments, and JSDoc on types, interfaces or plain constants are all removed.
 *
 * Auto-fixable: the fixer deletes the comment token, and the whole line when the comment owns it.
 * A comment is treated as a function's JSDoc when it leads the function or any declaration wrapping
 * it, so `\/** *\/ export const f = () => {}` and a documented object method both qualify.
 */
const commentPolicy = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      tsx: 'No comments in .tsx — names and structure are the documentation (AGENTS.md §5). Only toolchain directives are exempt.',
      ts: 'Only JSDoc documenting a function is allowed in .ts (AGENTS.md §5). Only toolchain directives are exempt.',
    },
  },
  create: (context) => {
    const filename = context.filename ?? context.getFilename();
    const isTsx = /\.tsx$/.test(filename);
    const isTs = /\.(ts|mts|cts)$/.test(filename);
    if (!isTsx && !isTs) return {};

    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const functionDocs = new Set();

    /** Declaration nodes a JSDoc block may sit in front of while still documenting the function. */
    const WRAPPERS = new Set([
      'VariableDeclarator',
      'VariableDeclaration',
      'ExportNamedDeclaration',
      'ExportDefaultDeclaration',
      'Property',
      'PropertyDefinition',
      'MethodDefinition',
      'CallExpression',
      'MemberExpression',
      'TSAsExpression',
    ]);

    const markFunctionDoc = (node) => {
      if (isTsx) return;
      let current = node;
      while (current) {
        for (const comment of sourceCode.getCommentsBefore(current)) {
          if (comment.type === 'Block' && comment.value.startsWith('*')) {
            functionDocs.add(comment);
          }
        }
        if (current.parent && WRAPPERS.has(current.parent.type)) {
          current = current.parent;
        } else break;
      }
    };

    const removal = (comment) => (fixer) => {
      const text = sourceCode.getText();
      let start = comment.range[0];
      let end = comment.range[1];
      while (
        start > 0 &&
        (text[start - 1] === ' ' || text[start - 1] === '\t')
      ) {
        start--;
      }
      if (start === 0 || text[start - 1] === '\n') {
        if (text[end] === '\r') end++;
        if (text[end] === '\n') end++;
      }
      return fixer.removeRange([start, end]);
    };

    return {
      ArrowFunctionExpression: markFunctionDoc,
      FunctionDeclaration: markFunctionDoc,
      FunctionExpression: markFunctionDoc,
      'Program:exit': () => {
        for (const comment of sourceCode.getAllComments()) {
          if (isDirectiveComment(comment.value)) continue;
          if (functionDocs.has(comment)) continue;
          context.report({
            node: comment,
            messageId: isTsx ? 'tsx' : 'ts',
            fix: removal(comment),
          });
        }
      },
    };
  },
};

const noServerFnsInComponents = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      noServerFns:
        'Components/lib must not import {{source}} at runtime — use the hooks/api layer (features/*/hooks.ts). Type-only imports are allowed. (AGENTS.md §4)',
    },
  },
  create: (context) => {
    const filename = context.filename ?? context.getFilename();
    if (!/\/src\/(components|lib)\//.test(filename)) return {};

    const BANNED = [
      '@founders-coffee/server-fns',
      '@founders-coffee/db',
      '@founders-coffee/domain',
    ];

    return {
      ImportDeclaration: (node) => {
        if (node.importKind === 'type') return;
        const source = node.source.value;
        if (BANNED.some((b) => source === b || source.startsWith(b + '/'))) {
          context.report({ node, messageId: 'noServerFns', data: { source } });
        }
      },
    };
  },
};

const localPlugin = {
  meta: { name: 'founders-coffee-local', version: '1.0.0' },
  rules: {
    'no-line-comments': noLineComments,
    'no-server-fns-in-components': noServerFnsInComponents,
    'comment-policy': commentPolicy,
  },
};

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      'libs/i18n/src/paraglide/**',
      '**/worker-configuration.d.ts',
    ],
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
      'local/no-server-fns-in-components': 'error',
      /* Files cap at 300 lines (AGENTS.md §5 — small, single-purpose units). Blank lines and
         comments count, so the number matches `wc -l` and the editor gutter with no arithmetic.
         A file that outgrows the cap is a file doing more than one job: split it by responsibility,
         do not reformat it under the limit. Exemptions are enumerated below, never inline. */
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: false, skipComments: false },
      ],
    },
  },
  /* Comment policy (AGENTS.md §5). TypeScript gets `comment-policy`; everything else keeps the
     plain line-comment ban. Scoped so exactly one rule fires per comment. */
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: { 'local/comment-policy': 'error' },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: { 'local/no-line-comments': 'error' },
  },
  /* Permanent `max-lines` exemptions — each is required to be one file by another rule.
     Nothing else belongs here; a file that is merely large belongs in the list after this one. */
  {
    files: [
      /* §11 — versioned state/city reference datasets, data rather than logic. */
      'libs/domain/src/geo/data/*.ts',
      /* §11 — "Schema in one place: libs/db. Never define tables elsewhere." */
      'libs/db/src/schema.ts',
    ],
    rules: { 'max-lines': 'off' },
  },
  /* Type-aware pass: a promise that is neither awaited, returned, nor handed to
     ctx.waitUntil() is cancelled when a Worker invocation completes, so a floating
     promise is silent data loss on this platform — an unawaited OTP send shipped a
     200 with no email. Cloudflare recommends this exact rule. */
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    /* Mirrors what the tsconfigs exclude: type-aware rules need a file to belong to a
       TS project, and tests/config/setup files deliberately sit outside them. */
    ignores: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.fixtures.ts',
      '**/*.config.ts',
      '**/*.config.mts',
      '**/setup.ts',
      '**/e2e/**',
      'vitest.workspace.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
];
