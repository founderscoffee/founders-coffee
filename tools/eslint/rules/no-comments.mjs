import { createCommentRemover, isDirectiveComment } from './comments.mjs';

/**
 * Config files carry no comments at all (AGENTS.md §5).
 *
 * A config file is wiring: which plugin, which glob, which path. Prose next to a setting drifts
 * from the setting, and a config file is the one place nobody re-reads when the value changes.
 * Rationale for a rule belongs beside the rule in `tools/eslint/`, and rationale for a decision
 * belongs in `docs/` and the commit that made it — both of which are versioned and reviewed.
 */
export const noComments = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      noComments:
        'No comments in config files (AGENTS.md §5) — put the rationale in docs/ or beside the rule it explains. Only toolchain directives are exempt.',
    },
  },
  create: (context) => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const removal = createCommentRemover(sourceCode);
    return {
      'Program:exit': () => {
        for (const comment of sourceCode.getAllComments()) {
          if (isDirectiveComment(comment.value)) continue;
          context.report({
            node: comment,
            messageId: 'noComments',
            fix: removal(comment),
          });
        }
      },
    };
  },
};
