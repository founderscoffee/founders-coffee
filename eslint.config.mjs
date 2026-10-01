import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

import {
  ALL_FILES,
  CALL_TO_ACTION_BUTTON_FILES,
  CONFIG_FILES,
  CONSOLE_ALLOWED,
  IGNORED,
  JS_FILES,
  MAX_LINES_EXEMPT,
  PRODUCT_COPY_FILES,
  REACT_SOURCE_FILES,
  SESSION_STORE_READERS,
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

const SESSION_STORE_READ = {
  object: 'authClient',
  property: 'useSession',
  message:
    "Render the session from useAuth() or useHydrationSafeSession(). The server renders it as still resolving, and a render that reads Better Auth's store itself can hydrate with an answer the server never rendered.",
};

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
      'no-restricted-properties': ['error', SESSION_STORE_READ],
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
    files: SESSION_STORE_READERS,
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: REACT_SOURCE_FILES,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'local/daisyui-control-size': 'error',
      'local/no-removed-daisyui-class': 'error',
    },
  },
  {
    files: CALL_TO_ACTION_BUTTON_FILES,
    rules: {
      'local/daisyui-control-size': ['error', { buttons: 'call-to-action' }],
    },
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
