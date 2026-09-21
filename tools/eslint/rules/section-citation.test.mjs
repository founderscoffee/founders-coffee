import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { sectionCitation } from './section-citation.mjs';

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const block = (body) => `/**\n * ${body}\n */\nexport const x = 1;\n`;

describe('local/section-citation', () => {
  it('accepts citations a reader can follow and refuses the rest', () => {
    tester.run('section-citation', sectionCitation, {
      valid: [
        { code: block('Atomic batches only (AGENTS.md §11).') },
        { code: block('Centralized RBAC (AGENTS §10), never ad hoc.') },
        { code: block('The bare form means AGENTS.md: §11.5 applies here.') },
        { code: block('Two at once (§7, §10) both resolve.') },
        { code: block('Phase gate: implementation-plan §5 describes it.') },
        { code: block('Topics are 32 bytes (RFC 8030 §5.4), so ids are cut.') },
        { code: block('A comment with no citation at all.') },
      ],
      invalid: [
        {
          code: block('Retention is twenty-four months (§5.21).'),
          errors: [{ messageId: 'unresolved' }],
        },
        {
          code: block('The window closes after seven days — §5.20 fixes it.'),
          errors: [{ messageId: 'unresolved' }],
        },
        {
          code: block(
            'Cites the plan for a section it lacks: implementation-plan §99.',
          ),
          errors: [{ messageId: 'unresolved' }],
        },
        {
          code: block(
            'The plan has no §16, though AGENTS.md does: implementation-plan §16.',
          ),
          errors: [{ messageId: 'unresolved' }],
        },
        {
          code: block(
            'Two dangling citations, §5.17 and §5.24, are two reports.',
          ),
          errors: [{ messageId: 'unresolved' }, { messageId: 'unresolved' }],
        },
      ],
    });
  });
});
