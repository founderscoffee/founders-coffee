import { readFileSync } from 'node:fs';

/**
 * The numbered headings a document defines, read once when the plugin loads.
 *
 * Both heading shapes in use are matched: `## 11. Database rules` and `## 11.5 Cloudflare platform
 * constraints`, the second of which carries no dot after the number.
 *
 * A document that is not there defines nothing, which reports its citations as unresolved rather
 * than throwing out of the plugin and taking every lint run down with it. That is the failure this
 * rule exists for: the documents these citations point at have been deleted once already.
 */
const headingsOf = (relative) => {
  let text = '';
  try {
    text = readFileSync(new URL(relative, import.meta.url), 'utf8');
  } catch {
    return new Set();
  }
  return new Set(
    [...text.matchAll(/^#{2,4}\s*(\d+(?:\.\d+)*)\.?\s+\S/gm)].map((m) => m[1]),
  );
};

const DOCUMENTS = {
  'AGENTS.md': headingsOf('../../../AGENTS.md'),
  'implementation-plan.md': headingsOf('../../../docs/implementation-plan.md'),
};

const EXTERNAL_STANDARD = /\b(?:RFC|ISO|ECMA|WCAG|BCP|IETF)\s*\d+\s*$/;
const PLAN = /implementation-plan[^§]*$/;

/**
 * Which document a citation is asking the reader to open.
 *
 * A bare `§11` means AGENTS.md, because that is the only document a rule can be stated in. Naming
 * the plan explicitly switches the lookup, so `implementation-plan §5` resolves against the plan's
 * own numbering rather than accidentally passing because AGENTS.md happens to have a §5 too.
 */
const documentFor = (before) =>
  PLAN.test(before) ? 'implementation-plan.md' : 'AGENTS.md';

/**
 * Every `§N` in a comment must name a section that exists.
 *
 * The repository used to carry 126 of these and 46 pointed at nothing: they cited an SRS numbering
 * that had drifted, then outlived the document entirely. The failure was silent in both directions
 * — a citation to a deleted section reads exactly like a citation to a live one, and a citation
 * that lands on an unrelated section of the surviving document reads better still, because it
 * resolves. `§6` meaning "the metrics definitions" quietly became `§6` meaning "Domain modeling
 * rules" and nothing complained.
 *
 * So a citation is only allowed to survive if a reader could follow it. Anything else states the
 * rule inline, where it sits next to the code that has to obey it and can be checked against it.
 * External standards cite their own numbering and are left alone.
 */
export const sectionCitation = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unresolved:
        'Citation §{{section}} does not exist in {{document}}. Cite a real section, or state the rule in the comment itself.',
    },
  },
  create: (context) => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          for (const match of comment.value.matchAll(/§(\d+(?:\.\d+)*)/g)) {
            const before = comment.value.slice(
              Math.max(0, match.index - 40),
              match.index,
            );
            if (EXTERNAL_STANDARD.test(before)) continue;
            const document = documentFor(before);
            if (DOCUMENTS[document].has(match[1])) continue;
            context.report({
              node: comment,
              messageId: 'unresolved',
              data: { section: match[1], document },
            });
          }
        }
      },
    };
  },
};
