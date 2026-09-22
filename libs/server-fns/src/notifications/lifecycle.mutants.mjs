export default {
  command: 'npx vitest run src/notifications/lifecycle.test.ts',
  cwd: 'libs/server-fns',
  mutants: [
    {
      name: 'the cancel path stops retiring anything',
      expect: 'fail',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: '    await cancelNotificationsByEvent(db, { eventId: opts.eventId });',
          replace: '',
        },
      ],
    },
    {
      name: '#80 fixed with an unscoped cancel, placed after the fan-out',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/closeout.ts',
          find: '  await enqueueFeedbackInvitations(db, event);',
          replace:
            '  await enqueueFeedbackInvitations(db, event);\n  await cancelNotificationsByEvent(db, { eventId: opts.input.eventId });',
        },
        {
          file: 'src/operations/closeout.ts',
          find: "import { enqueueDidNotHappenNotices } from '../notifications/did-not-happen.js';",
          replace:
            "import { cancelNotificationsByEvent } from '@founders-coffee/db';\nimport { enqueueDidNotHappenNotices } from '../notifications/did-not-happen.js';",
        },
      ],
    },
    {
      name: '#80 fixed properly, with the parked entry left behind',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/closeout.ts',
          find: '  await enqueueFeedbackInvitations(db, event);',
          replace:
            '  await cancelNotificationsByEvent(db, { eventId: opts.input.eventId });\n  await enqueueFeedbackInvitations(db, event);',
        },
        {
          file: 'src/operations/closeout.ts',
          find: "import { enqueueDidNotHappenNotices } from '../notifications/did-not-happen.js';",
          replace:
            "import { cancelNotificationsByEvent } from '@founders-coffee/db';\nimport { enqueueDidNotHappenNotices } from '../notifications/did-not-happen.js';",
        },
      ],
    },
    {
      name: 'a defect parked with no issue number to close it against',
      expect: 'fail',
      edits: [
        {
          file: 'src/notifications/lifecycle.test.ts',
          find: "    drops: ['closeout_prompt'],\n    keeps: ['feedback_invitation'],",
          replace:
            "    drops: ['closeout_prompt'],\n    keeps: ['feedback_invitation'],\n    open: { closeout_prompt: 'parked for now' },",
        },
      ],
    },
    {
      name: 'a key parked as open that the transition never claimed to retire',
      expect: 'fail',
      edits: [
        {
          file: 'src/notifications/lifecycle.test.ts',
          find: "    drops: ['closeout_prompt'],\n    keeps: ['feedback_invitation'],",
          replace:
            "    drops: ['closeout_prompt'],\n    keeps: ['feedback_invitation'],\n    open: { feedback_invitation: '#80 — parked by mistake' },",
        },
      ],
    },
    {
      name: 'a transition that declares it retires nothing',
      expect: 'fail',
      edits: [
        {
          file: 'src/notifications/lifecycle.test.ts',
          find: "    drops: ['closeout_prompt'],\n    keeps: ['feedback_invitation'],",
          replace: "    drops: [],\n    keeps: ['feedback_invitation'],",
        },
      ],
    },
    {
      name: 'a rename inside the cancel path that changes no behaviour',
      expect: 'pass',
      edits: [
        {
          file: 'src/events/cancel.ts',
          find: "  logger.info('event_cancelled', {",
          replace: "  logger.info('event_called_off', {",
        },
      ],
    },
  ],
};
