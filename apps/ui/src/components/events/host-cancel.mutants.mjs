export default {
  command: 'npx vitest run src/components/events/HostEventPanel.test.tsx',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'the cancel button offered again after the meetup has ended, which is #74 in the interface',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/HostEventPanel.tsx',
          find: '      {!isCancelled && !hasEnded && (',
          replace: '      {!isCancelled && (',
        },
      ],
    },
    {
      name: 'the button withdrawn while the meetup is still under way',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/HostEventPanel.tsx',
          find: '  const hasEnded =\n    event.endsAt !== null && new Date(event.endsAt).getTime() <= Date.now();',
          replace:
            '  const hasEnded =\n    new Date(event.startsAt).getTime() <= Date.now();',
        },
      ],
    },
    {
      name: 'a meetup with no end treated as one that has finished',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/HostEventPanel.tsx',
          find: '  const hasEnded =\n    event.endsAt !== null && new Date(event.endsAt).getTime() <= Date.now();',
          replace:
            '  const hasEnded =\n    new Date(event.endsAt ?? 0).getTime() <= Date.now();',
        },
      ],
    },
    {
      name: 'the button withdrawn from a meetup still ahead',
      expect: 'fail',
      edits: [
        {
          file: 'src/components/events/HostEventPanel.tsx',
          find: '      {!isCancelled && !hasEnded && (',
          replace: '      {false && (',
        },
      ],
    },
    {
      name: 'the edit link restyled, which the cancel rule does not share',
      expect: 'pass',
      edits: [
        {
          file: 'src/components/events/HostEventPanel.tsx',
          find: '            className="btn btn-outline btn-sm w-fit"',
          replace: '            className="btn btn-ghost btn-sm w-fit"',
        },
      ],
    },
  ],
};
