export default {
  command: 'npx vitest run src/operations/user-id-contract.test.ts',
  cwd: 'libs/domain',
  mutants: [
    {
      name: 'recordAttendanceSchema put back on the entity id format',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/schemas.ts',
          find: 'export const recordAttendanceSchema = z.strictObject({\n  eventId: idSchema,\n  userId: userIdSchema,',
          replace:
            'export const recordAttendanceSchema = z.strictObject({\n  eventId: idSchema,\n  userId: idSchema,',
        },
      ],
    },
    {
      name: 'the batch entry put back on the entity id format',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/schemas.ts',
          find: '      z.strictObject({\n        userId: userIdSchema,\n        outcome: attendanceOutcomeSchema,\n      }),',
          replace:
            '      z.strictObject({ userId: idSchema, outcome: attendanceOutcomeSchema }),',
        },
      ],
    },
    {
      name: 'updateHostTrustSchema put back on the entity id format',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/schemas.ts',
          find: '    marketCode: marketCodeSchema,\n    userId: userIdSchema,\n    status: hostTrustStatusSchema,',
          replace:
            '    marketCode: marketCodeSchema,\n    userId: idSchema,\n    status: hostTrustStatusSchema,',
        },
      ],
    },
    {
      name: 'recordReviewSchema put back on the entity id format',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/schemas.ts',
          find: '    ownerUserId: userIdSchema,',
          replace: '    ownerUserId: idSchema,',
        },
      ],
    },
    {
      name: 'the contract tightened to the shape Better Auth happens to mint today',
      expect: 'fail',
      edits: [
        {
          file: '../core/src/validation.ts',
          find: 'export const userIdSchema = z.string().trim().min(1).max(128);',
          replace:
            'export const userIdSchema = z.string().trim().regex(/^[A-Za-z0-9]{32}$/);',
        },
      ],
    },
    {
      name: 'the upper bound removed, leaving presence as the whole contract',
      expect: 'fail',
      edits: [
        {
          file: '../core/src/validation.ts',
          find: 'export const userIdSchema = z.string().trim().min(1).max(128);',
          replace: 'export const userIdSchema = z.string().trim().min(1);',
        },
      ],
    },
    {
      name: 'presence dropped, leaving the empty string acceptable',
      expect: 'fail',
      edits: [
        {
          file: '../core/src/validation.ts',
          find: 'export const userIdSchema = z.string().trim().min(1).max(128);',
          replace: 'export const userIdSchema = z.string().trim().max(128);',
        },
      ],
    },
    {
      name: 'the entity id format widened until it stops describing entity ids',
      expect: 'fail',
      edits: [
        {
          file: '../core/src/validation.ts',
          find: "export const idSchema = z\n  .string()\n  .regex(/^[a-z]{2,8}_[0-9a-f]{32}$/, 'Invalid id');",
          replace:
            "export const idSchema = z.string().regex(/^[A-Za-z0-9_]+$/, 'Invalid id');",
        },
      ],
    },
    {
      name: 'an unrelated bound moved, which the account contract does not depend on',
      expect: 'pass',
      edits: [
        {
          file: 'src/operations/schemas.ts',
          find: 'export const WALK_IN_MAX = 500;',
          replace: 'export const WALK_IN_MAX = 400;',
        },
      ],
    },
  ],
};
