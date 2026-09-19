import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { noServerFnsInComponents } from './no-server-fns-in-components.mjs';

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const at = (path) => `/repo/apps/ui/src/${path}`;

describe('local/no-server-fns-in-components', () => {
  it('guards features/, components/ and lib/ without blocking api.ts', () => {
    tester.run('no-server-fns-in-components', noServerFnsInComponents, {
      valid: [
        {
          code: "import { createEvent } from '@founders-coffee/server-fns';",
          filename: at('features/events/api.ts'),
        },
        {
          code: "import { events } from '@founders-coffee/domain';",
          filename: at('features/events/validation.ts'),
        },
        {
          code: "import type { Market } from '@founders-coffee/db';",
          filename: at('components/events/Card.tsx'),
        },
        {
          code: "import { type Market } from '@founders-coffee/db';",
          filename: at('components/events/Card.tsx'),
        },
        {
          code: "import { events } from '@founders-coffee/domain';",
          filename: at('routes/index.tsx'),
        },
      ],
      invalid: [
        {
          code: "import { createEvent } from '@founders-coffee/server-fns';",
          filename: at('features/push/client.ts'),
          errors: [{ messageId: 'server' }],
        },
        {
          code: "import { createEvent } from '@founders-coffee/server-fns';",
          filename: at('features/events/components/EventCard.tsx'),
          errors: [{ messageId: 'server' }],
        },
        {
          code: "import { events } from '@founders-coffee/domain';",
          filename: at('features/events/components/EventCard.tsx'),
          errors: [{ messageId: 'domain' }],
        },
        {
          code: "import { getMarket } from '@founders-coffee/db';",
          filename: at('components/events/Card.tsx'),
          errors: [{ messageId: 'server' }],
        },
        {
          code: "import { createEvent } from '@founders-coffee/server-fns';",
          filename: at('lib/app-providers.tsx'),
          errors: [{ messageId: 'server' }],
        },
      ],
    });
  });
});
