import nx from '@nx/eslint-plugin';

import {
  ALL_FILES,
  CONFIG_FILES,
  IGNORED,
  JS_FILES,
  MAX_LINES_EXEMPT,
  TS_FILES,
  UNTYPED_FILES,
} from './tools/eslint/file-globs.mjs';
import { depConstraints } from './tools/eslint/module-boundaries.mjs';
import { localPlugin } from './tools/eslint/plugin.mjs';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  { ignores: IGNORED },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints,
        },
      ],
    },
  },
  {
    files: ALL_FILES,
    plugins: { local: localPlugin },
    rules: {
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
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: false, skipComments: false },
      ],
    },
  },
  {
    files: TS_FILES,
    rules: { 'local/comment-policy': 'error' },
  },
  {
    files: JS_FILES,
    rules: { 'local/no-line-comments': 'error' },
  },
  {
    files: CONFIG_FILES,
    rules: {
      'local/comment-policy': 'off',
      'local/no-line-comments': 'off',
      'local/no-comments': 'error',
    },
  },
  {
    files: MAX_LINES_EXEMPT,
    rules: { 'max-lines': 'off' },
  },
  {
    files: TS_FILES,
    ignores: UNTYPED_FILES,
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
