/**
 * Shared helpers for the comment rules (AGENTS.md §5).
 *
 * Toolchain directives are exempt from every comment rule in this directory — without them
 * `eslint-disable`, `@ts-expect-error` and TypeScript `/// <reference />` could not be written at
 * all. `@ts-expect-error` carries its §5 justification inside the directive itself.
 */
export const isDirectiveComment = (value) =>
  /^\s*(eslint-(disable|enable)(-(next-)?line)?|@ts-|\/\s*<reference|globals?\s|@internal|istanbul |prettier-)/.test(
    value,
  );

/**
 * Builds the auto-fixer shared by every comment rule: deletes the comment token, and the whole
 * line when the comment is the only thing on it. `eslint --fix` therefore removes a disallowed
 * comment without leaving a blank line behind.
 */
export const createCommentRemover = (sourceCode) => (comment) => (fixer) => {
  const text = sourceCode.getText();
  let start = comment.range[0];
  let end = comment.range[1];
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) {
    start--;
  }
  if (start === 0 || text[start - 1] === '\n') {
    if (text[end] === '\r') end++;
    if (text[end] === '\n') end++;
  }
  return fixer.removeRange([start, end]);
};
