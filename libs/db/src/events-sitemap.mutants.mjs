export default {
  command: 'npx vitest run src/events-sitemap.test.ts',
  cwd: 'libs/db',
  mutants: [
    {
      name: 'the upcoming scope dropped, so finished gatherings keep their city listed — a smaller #82',
      expect: 'fail',
      edits: [
        {
          file: 'src/events-sitemap.ts',
          find: "    .where(and(upcomingScope(now), eq(events.status, 'published')))",
          replace: "    .where(eq(events.status, 'published'))",
        },
      ],
    },
    {
      name: 'the published filter dropped, so a cancelled gathering advertises its city',
      expect: 'fail',
      edits: [
        {
          file: 'src/events-sitemap.ts',
          find: "    .where(and(upcomingScope(now), eq(events.status, 'published')))",
          replace: '    .where(upcomingScope(now))',
        },
      ],
    },
    {
      name: 'distinct dropped, so a busy city is advertised once per gathering',
      expect: 'fail',
      edits: [
        {
          file: 'src/events-sitemap.ts',
          find: '    .selectDistinct({',
          replace: '    .select({',
        },
      ],
    },
    {
      name: 'the query answers every city it can see regardless of events',
      expect: 'fail',
      edits: [
        {
          file: 'src/events-sitemap.ts',
          find: "    .where(and(upcomingScope(now), eq(events.status, 'published')))",
          replace: '    .where(undefined)',
        },
      ],
    },
    {
      name: 'the ordering changed, which nothing asserts on',
      expect: 'pass',
      edits: [
        {
          file: 'src/events-sitemap.ts',
          find: '    .orderBy(events.marketCode, events.cityCode);',
          replace: '    .orderBy(events.cityCode, events.marketCode);',
        },
      ],
    },
  ],
};
