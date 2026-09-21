export default {
  command: 'npx vitest run src/operations/feedback.test.ts',
  cwd: 'libs/server-fns',
  mutants: [
    {
      name: 'the short-circuit dropped, so a self-rating from before the guard buys a view of the form',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/feedback.ts',
          find: "  if (status === 'is_host') return err(feedbackError(status));\n",
          replace: '',
        },
      ],
    },
    {
      name: 'is_host loses its own error, falling through to not_invited',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/feedback.ts',
          find: "  if (status === 'is_host')\n    return new AppError(\n      'feedback_is_host',\n      'A host cannot rate their own meetup',\n    );\n",
          replace: '',
        },
      ],
    },
    {
      name: 'the host told they did not attend, which is the message #77 called false',
      expect: 'fail',
      edits: [
        {
          file: 'src/operations/feedback.ts',
          find: "      'feedback_is_host',\n      'A host cannot rate their own meetup',",
          replace:
            "      'feedback_not_attended',\n      'A host cannot rate their own meetup',",
        },
      ],
    },
    {
      name: 'the developer-facing message reworded, which no assertion reads',
      expect: 'pass',
      edits: [
        {
          file: 'src/operations/feedback.ts',
          find: "      'A host cannot rate their own meetup',",
          replace: "      'The host of a meetup may not rate it',",
        },
      ],
    },
  ],
};
