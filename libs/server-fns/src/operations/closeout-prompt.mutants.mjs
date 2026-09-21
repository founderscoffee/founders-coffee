export default {
  command: 'npx vitest run src/operations/closeout.prompt.test.ts',
  cwd: 'libs/server-fns',
  mutants: [
    {
      name: 'the cancel removed, which is #80 itself',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/closeout.ts',
          find: "  await cancelNotificationsByTemplate(db, {\n    eventId: opts.input.eventId,\n    templateKeys: ['closeout_prompt'],\n  });\n\n",
          replace: '',
        },
      ],
    },
    {
      name: 'the cancel moved below the did-not-happen arm, which returns early',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/closeout.ts',
          find: "  await cancelNotificationsByTemplate(db, {\n    eventId: opts.input.eventId,\n    templateKeys: ['closeout_prompt'],\n  });\n\n  if (opts.input.outcome === 'did_not_happen') {",
          replace: "  if (opts.input.outcome === 'did_not_happen') {",
        },
        {
          file: 'src/operations/closeout.ts',
          find: '  await enqueueFeedbackInvitations(db, event);',
          replace:
            "  await cancelNotificationsByTemplate(db, {\n    eventId: opts.input.eventId,\n    templateKeys: ['closeout_prompt'],\n  });\n  await enqueueFeedbackInvitations(db, event);",
        },
      ],
    },
    {
      name: 'the scope widened to every template, so a resubmission silences the first attempt’s invitations',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/closeout.ts',
          find: "  await cancelNotificationsByTemplate(db, {\n    eventId: opts.input.eventId,\n    templateKeys: ['closeout_prompt'],\n  });",
          replace:
            "  await cancelNotificationsByTemplate(db, {\n    eventId: opts.input.eventId,\n    templateKeys: [\n      'closeout_prompt',\n      'feedback_invitation',\n      'event_did_not_happen',\n    ],\n  });",
        },
      ],
    },
    {
      name: 'the template filter dropped from the helper, cancelling everything pending',
      expect: 'fail',
      edits: [
        {
          file: 'src/notifications/../../../db/src/notifications.ts',
          find: '        inArray(scheduledNotifications.templateKey, [...opts.templateKeys]),\n      ),\n    );\n\n  return (result.meta?.changes ?? 0) as number;\n};\n\n/**\n * Check if a pending notification already exists',
          replace:
            '      ),\n    );\n\n  return (result.meta?.changes ?? 0) as number;\n};\n\n/**\n * Check if a pending notification already exists',
        },
      ],
    },
    {
      name: 'the event filter dropped, so closing one gathering out silences another',
      expect: 'fail',
      edits: [
        {
          file: 'src/notifications/../../../db/src/notifications.ts',
          find: "        eq(scheduledNotifications.eventId, opts.eventId),\n        eq(scheduledNotifications.status, 'pending'),\n        inArray(scheduledNotifications.templateKey, [...opts.templateKeys]),",
          replace:
            "        eq(scheduledNotifications.status, 'pending'),\n        inArray(scheduledNotifications.templateKey, [...opts.templateKeys]),",
        },
      ],
    },
    {
      name: 'the empty-list guard inverted, cancelling everything when nothing was named',
      expect: 'pass',
      edits: [
        {
          file: 'src/notifications/../../../db/src/notifications.ts',
          find: '  if (opts.templateKeys.length === 0) return 0;',
          replace: '  if (opts.templateKeys.length < 0) return 0;',
        },
      ],
    },
  ],
};
