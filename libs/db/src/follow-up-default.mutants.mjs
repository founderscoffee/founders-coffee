export default {
  command:
    'npx vitest run src/notification-destinations.test.ts src/account-preferences.test.ts',
  cwd: 'libs/db',
  mutants: [
    {
      name: 'the column default goes back off, so a new account is never asked',
      expect: 'fail',
      edits: [
        {
          file: 'migrations/0032_follow_up_prompts_default_on.sql',
          find: '`follow_up_prompts` integer DEFAULT true NOT NULL,',
          replace: '`follow_up_prompts` integer DEFAULT false NOT NULL,',
        },
      ],
    },
    {
      name: 'the column mask goes back to zero, which reads as every channel off',
      expect: 'fail',
      edits: [
        {
          file: 'migrations/0032_follow_up_prompts_default_on.sql',
          find: '`follow_up_prompts_channels` integer DEFAULT 4 NOT NULL,',
          replace: '`follow_up_prompts_channels` integer DEFAULT 0 NOT NULL,',
        },
      ],
    },
    {
      name: 'the column mask becomes 5, quietly opting new accounts into push too',
      expect: 'fail',
      edits: [
        {
          file: 'migrations/0032_follow_up_prompts_default_on.sql',
          find: '`follow_up_prompts_channels` integer DEFAULT 4 NOT NULL,',
          replace: '`follow_up_prompts_channels` integer DEFAULT 5 NOT NULL,',
        },
      ],
    },
    {
      name: 'the no-row fallback drifts back to off while the column stays on',
      expect: 'fail',
      edits: [
        {
          file: 'src/notification-destinations.ts',
          find: 'followUpPromptsChannels: sql<number>`coalesce(${accountPreferences.followUpPromptsChannels}, 4)`,',
          replace:
            'followUpPromptsChannels: sql<number>`coalesce(${accountPreferences.followUpPromptsChannels}, 0)`,',
        },
      ],
    },
    {
      name: 'the no-row fallback drifts to 5, disagreeing with the column it mirrors',
      expect: 'fail',
      edits: [
        {
          file: 'src/notification-destinations.ts',
          find: 'followUpPromptsChannels: sql<number>`coalesce(${accountPreferences.followUpPromptsChannels}, 4)`,',
          replace:
            'followUpPromptsChannels: sql<number>`coalesce(${accountPreferences.followUpPromptsChannels}, 5)`,',
        },
      ],
    },
    {
      name: 'the mask test becomes > 0, which is the same thing for a non-negative mask',
      expect: 'pass',
      edits: [
        {
          file: 'src/notification-destinations.ts',
          find: 'followUpPrompts: sql<number>`case when coalesce(${accountPreferences.followUpPromptsChannels}, 4) != 0 then 1 else 0 end`,',
          replace:
            'followUpPrompts: sql<number>`case when coalesce(${accountPreferences.followUpPromptsChannels}, 4) > 0 then 1 else 0 end`,',
        },
      ],
    },
  ],
};
