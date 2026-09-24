import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

import {
  ALL_FILES,
  CONFIG_FILES,
  CONSOLE_ALLOWED,
  IGNORED,
  JS_FILES,
  MAX_LINES_EXEMPT,
  PRODUCT_COPY_FILES,
  REACT_SOURCE_FILES,
  STATUS_COMPONENTS,
  TS_FILES,
  UNTYPED_FILES,
} from './tools/eslint/file-globs.mjs';
import { depConstraints } from './tools/eslint/module-boundaries.mjs';
import { localPlugin } from './tools/eslint/plugin.mjs';

const ARROW_FUNCTIONS_ONLY = [
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
];

const EM_DASH =
  'Product copy carries no em dash: use a full stop, a colon, or "·".';

const NO_EM_DASH_IN_COPY = [
  { selector: 'Literal[value=/\u2014/]', message: EM_DASH },
  { selector: 'TemplateElement[value.raw=/\u2014/]', message: EM_DASH },
  { selector: 'JSXText[value=/\u2014/]', message: EM_DASH },
];

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
      'no-restricted-syntax': ['error', ...ARROW_FUNCTIONS_ONLY],
      'local/no-server-fns-in-components': 'error',
      'local/no-bare-status-role': 'error',
      'local/section-citation': 'error',
      'no-console': 'error',
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: false, skipComments: false },
      ],
    },
  },
  {
    files: CONSOLE_ALLOWED,
    rules: { 'no-console': 'off' },
  },
  {
    files: TS_FILES,
    rules: {
      'local/comment-policy': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
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
    files: STATUS_COMPONENTS,
    rules: { 'local/no-bare-status-role': 'off' },
  },
  {
    files: REACT_SOURCE_FILES,
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
  {
    files: PRODUCT_COPY_FILES,
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...ARROW_FUNCTIONS_ONLY,
        ...NO_EM_DASH_IN_COPY,
      ],
    },
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
