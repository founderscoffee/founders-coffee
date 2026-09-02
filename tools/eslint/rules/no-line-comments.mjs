import { isDirectiveComment } from './comments.mjs';

/**
 * Bans `//` line comments outside TypeScript and config files (AGENTS.md §5). TypeScript is held
 * to the stricter `comment-policy`, and config files to `no-comments`, so exactly one comment rule
 * fires on any given comment.
 */
export const noLineComments = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      noLine:
        'No `//` line comments — use a block comment for documentation (AGENTS.md §5). Directive comments (eslint-/@ts-) are allowed.',
    },
  },
  create: (context) => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === 'Line' && !isDirectiveComment(comment.value)) {
            context.report({ node: comment, messageId: 'noLine' });
          }
        }
      },
    };
  },
};
