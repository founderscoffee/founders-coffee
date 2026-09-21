export default {
  command: 'npx vitest run dev-seed',
  cwd: 'tools',
  mutants: [
    {
      name: 'the insert stops yielding to what is already there',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/sql.mjs',
          find: "    'ON CONFLICT DO NOTHING;',",
          replace: "    ';',",
        },
      ],
    },
    {
      name: 'the closeout-ready event has not ended after all',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/rows.mjs',
          find: '      ends_at: now - 2 * HOUR,',
          replace: '      ends_at: now + 2 * HOUR,',
        },
      ],
    },
    {
      name: 'the ended event is seeded without the attendees it needs',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/rows.mjs',
          find: '      rsvps: attendees.length,',
          replace: '      rsvps: 0,',
        },
      ],
    },
    {
      name: 'ids start moving with the clock, so a reseed duplicates everything',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/rows.mjs',
          find: "      id: derivedId('evt', 'dev-closeout-ready'),\n      slug: 'dev-closeout-ready',",
          replace:
            "      id: derivedId('evt', `dev-closeout-ready/${now}`),\n      slug: 'dev-closeout-ready',",
        },
      ],
    },
    {
      name: 'a quote in a value stops being escaped',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/sql.mjs',
          find: "  return `'${value.replaceAll(\"'\", \"''\")}'`;",
          replace: "  return `'${value}'`;",
        },
      ],
    },
    {
      name: 'the seeded market drifts from the one libs/db declares',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/rows.mjs',
          find: "    name: 'Algeria',",
          replace: "    name: 'Algerie',",
        },
      ],
    },
    {
      name: 'accounts arrive without the profile rows every user has',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/statements.mjs',
          find: "    insertIgnore(\n      'member_profiles',\n      ACCOUNT_ROWS.map((account) => ({ user_id: account.id })),\n    ),",
          replace: "    '',",
        },
      ],
    },
    {
      name: 'the second market removed, leaving nothing to cross',
      expect: 'fail',
      edits: [
        {
          file: 'dev-seed/rows.mjs',
          find: "      market_code: 'EG',",
          replace: "      market_code: 'DZ',",
        },
      ],
    },
    {
      name: 'a venue renamed, which none of the contracts depend on',
      expect: 'pass',
      edits: [
        {
          file: 'dev-seed/rows.mjs',
          find: "      venue: 'Cairo Coworking, Zamalek',",
          replace: "      venue: 'Another Cairo Address',",
        },
      ],
    },
  ],
};
