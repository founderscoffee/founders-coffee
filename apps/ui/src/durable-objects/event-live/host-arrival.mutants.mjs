export default {
  command: 'npx vitest run src/durable-objects/event-live/roster.test.ts',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'the host arrives in the host record only, as it used to work',
      expect: 'fail',
      edits: [
        {
          file: 'src/durable-objects/event-live/roster.ts',
          find: "    const attendee = this.attendees.get(this.host.userId);\n    if (attendee) attendee.status = 'arrived';\n",
          replace: '',
        },
      ],
    },
    {
      name: 'the host lands on the wrong status, so the room still undercounts',
      expect: 'fail',
      edits: [
        {
          file: 'src/durable-objects/event-live/roster.ts',
          find: "    if (attendee) attendee.status = 'arrived';",
          replace: "    if (attendee) attendee.status = 'walking_in';",
        },
      ],
    },
    {
      name: 'arriving moves every attendee, not the host who said it',
      expect: 'fail',
      edits: [
        {
          file: 'src/durable-objects/event-live/roster.ts',
          find: "    const attendee = this.attendees.get(this.host.userId);\n    if (attendee) attendee.status = 'arrived';",
          replace:
            "    for (const attendee of this.attendees.values())\n      attendee.status = 'arrived';",
        },
      ],
    },
  ],
};
