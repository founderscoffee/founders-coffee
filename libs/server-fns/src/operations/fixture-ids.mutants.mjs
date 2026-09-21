export default {
  command: 'npx vitest run src/operations/fixture-ids.test.ts',
  cwd: 'libs/server-fns',
  mutants: [
    {
      name: 'pastEvent put back on the counter-shaped id it used to mint',
      expect: 'fail',
      edits: [
        {
          file: '../db/src/operations.fixtures.ts',
          find: "  const eventId = id('evt');\n  await createEvent(db, {\n    id: eventId,\n    slug: `ops-fixture-${n}`,",
          replace:
            "  const eventId = `evt_ops${String(n).padStart(3, '0')}`;\n  await createEvent(db, {\n    id: eventId,\n    slug: `ops-fixture-${n}`,",
        },
      ],
    },
    {
      name: 'futureEvent put back on the counter-shaped id it used to mint',
      expect: 'fail',
      edits: [
        {
          file: '../db/src/operations.fixtures.ts',
          find: "  const eventId = id('evt');\n  await createEvent(db, {\n    id: eventId,\n    slug: `ops-future-${n}`,",
          replace:
            "  const eventId = `evt_ops${String(n).padStart(3, '0')}`;\n  await createEvent(db, {\n    id: eventId,\n    slug: `ops-future-${n}`,",
        },
      ],
    },
    {
      name: 'a prefix too short for the id format',
      expect: 'fail',
      edits: [
        {
          file: '../db/src/operations.fixtures.ts',
          find: "  const eventId = id('evt');\n  await createEvent(db, {\n    id: eventId,\n    slug: `ops-fixture-${n}`,",
          replace:
            "  const eventId = id('e');\n  await createEvent(db, {\n    id: eventId,\n    slug: `ops-fixture-${n}`,",
        },
      ],
    },
    {
      name: 'the closeout write boundary loosened to any non-empty string',
      expect: 'fail',
      edits: [
        {
          file: '../domain/src/operations/schemas.ts',
          find: 'export const submitCloseoutSchema = z\n  .strictObject({\n    eventId: idSchema,',
          replace:
            'export const submitCloseoutSchema = z\n  .strictObject({\n    eventId: z.string().min(1),',
        },
      ],
    },
    {
      name: 'the closeout read boundary tightened until the asymmetry disappears',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/schemas.ts',
          find: 'export const closeoutViewRequestSchema = z.strictObject({\n  eventId: z.string().min(1),\n});',
          replace:
            'export const closeoutViewRequestSchema = z.strictObject({\n  eventId: z.string().regex(/^[a-z]{2,8}_[0-9a-f]{32}$/),\n});',
        },
      ],
    },
    {
      name: 'cleanup put back on the id pattern the ids no longer spell',
      expect: 'fail',
      edits: [
        {
          file: '../db/src/operations.fixtures.ts',
          find: '  await db\n    .delete(events)\n    .where(inArray(events.hostId, [HOST_ID, MEMBER_ID, OTHER_ID]))\n    .run();',
          replace:
            "  await db.run(sql`DELETE FROM events WHERE id LIKE 'evt_ops%'`);",
        },
      ],
    },
    {
      name: 'fixture prose changed, which the id contract does not depend on',
      expect: 'pass',
      edits: [
        {
          file: '../db/src/operations.fixtures.ts',
          find: "    description: 'An event used to exercise the operations schema.',",
          replace: "    description: 'Some other description entirely.',",
        },
      ],
    },
  ],
};
