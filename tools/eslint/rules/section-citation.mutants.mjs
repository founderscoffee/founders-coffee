export default {
  command:
    'npx vitest run tools/eslint/rules/section-citation.test.mjs --root .',
  cwd: '.',
  mutants: [
    {
      name: 'the external-standard escape removed, so RFC 8030 §5.4 is reported as ours',
      expect: 'fail',
      edits: [
        {
          file: 'tools/eslint/rules/section-citation.mjs',
          find: '            if (EXTERNAL_STANDARD.test(before)) continue;',
          replace: '',
        },
      ],
    },
    {
      name: 'every citation resolved against AGENTS.md, so the plan is never consulted',
      expect: 'fail',
      edits: [
        {
          file: 'tools/eslint/rules/section-citation.mjs',
          find: "  PLAN.test(before) ? 'implementation-plan.md' : 'AGENTS.md';",
          replace: "  before ? 'AGENTS.md' : 'AGENTS.md';",
        },
      ],
    },
    {
      name: 'the citation pattern stops at the first number, so §5.21 passes as §5',
      expect: 'fail',
      edits: [
        {
          file: 'tools/eslint/rules/section-citation.mjs',
          find: '/§(\\d+(?:\\.\\d+)*)/g',
          replace: '/§(\\d+)/g',
        },
      ],
    },
    {
      name: 'the membership test inverted, so only real sections are reported',
      expect: 'fail',
      edits: [
        {
          file: 'tools/eslint/rules/section-citation.mjs',
          find: '            if (DOCUMENTS[document].has(match[1])) continue;',
          replace:
            '            if (!DOCUMENTS[document].has(match[1])) continue;',
        },
      ],
    },
    {
      name: 'the lookbehind shortened to nothing, so no citation can name its document',
      expect: 'fail',
      edits: [
        {
          file: 'tools/eslint/rules/section-citation.mjs',
          find: '              Math.max(0, match.index - 40),',
          replace: '              Math.max(0, match.index - 0),',
        },
      ],
    },
    {
      name: 'the heading pattern accepts deeper headings, which neither document uses',
      expect: 'pass',
      edits: [
        {
          file: 'tools/eslint/rules/section-citation.mjs',
          find: '/^#{2,4}\\s*(\\d+(?:\\.\\d+)*)\\.?\\s+\\S/gm',
          replace: '/^#{2,5}\\s*(\\d+(?:\\.\\d+)*)\\.?\\s+\\S/gm',
        },
      ],
    },
  ],
};
