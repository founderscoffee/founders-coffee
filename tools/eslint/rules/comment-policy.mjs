import { createCommentRemover, isDirectiveComment } from './comments.mjs';

/**
 * The TypeScript comment policy (AGENTS.md §5).
 *
 * `.tsx` carries no comments at all — markup and component names are the documentation.
 * `.ts` carries only JSDoc documenting a function; file headers, narrative block comments, and
 * JSDoc on types, interfaces or plain constants are all removed.
 *
 * A comment counts as a function's JSDoc when it leads the function or any declaration wrapping
 * it, so a documented `export const f = () => {}` and a documented object method both qualify.
 */
const WRAPPERS = new Set([
  'VariableDeclarator',
  'VariableDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'Property',
  'PropertyDefinition',
  'MethodDefinition',
  'CallExpression',
  'MemberExpression',
  'TSAsExpression',
]);

export const commentPolicy = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      tsx: 'No comments in .tsx — names and structure are the documentation (AGENTS.md §5). Only toolchain directives are exempt.',
      ts: 'Only JSDoc documenting a function is allowed in .ts (AGENTS.md §5). Only toolchain directives are exempt.',
    },
  },
  create: (context) => {
    const filename = context.filename ?? context.getFilename();
    const isTsx = /\.tsx$/.test(filename);
    const isTs = /\.(ts|mts|cts)$/.test(filename);
    if (!isTsx && !isTs) return {};

    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const removal = createCommentRemover(sourceCode);
    const functionDocs = new Set();

    const markFunctionDoc = (node) => {
      if (isTsx) return;
      let current = node;
      while (current) {
        for (const comment of sourceCode.getCommentsBefore(current)) {
          if (comment.type === 'Block' && comment.value.startsWith('*')) {
            functionDocs.add(comment);
          }
        }
        if (current.parent && WRAPPERS.has(current.parent.type)) {
          current = current.parent;
        } else break;
      }
    };

    return {
      ArrowFunctionExpression: markFunctionDoc,
      FunctionDeclaration: markFunctionDoc,
      FunctionExpression: markFunctionDoc,
      'Program:exit': () => {
        for (const comment of sourceCode.getAllComments()) {
          if (isDirectiveComment(comment.value)) continue;
          if (functionDocs.has(comment)) continue;
          context.report({
            node: comment,
            messageId: isTsx ? 'tsx' : 'ts',
            fix: removal(comment),
          });
        }
      },
    };
  },
};
