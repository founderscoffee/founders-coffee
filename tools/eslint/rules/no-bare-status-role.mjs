const LIVE_ROLES = new Set(['alert', 'status']);

const TYPE_WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression']);

/**
 * What a `const` holds, when an identifier names one. Anything that can be reassigned, or that
 * is not a plain variable, holds nothing this rule can know, so it resolves to nothing.
 */
const constantValue = (context, identifier) => {
  for (
    let scope = context.sourceCode.getScope(identifier);
    scope;
    scope = scope.upper
  ) {
    const variable = scope.set.get(identifier.name);
    if (!variable) continue;
    const [definition] = variable.defs;
    const isConstant =
      definition?.type === 'Variable' &&
      definition.parent.kind === 'const' &&
      definition.node.id.type === 'Identifier';
    return isConstant ? definition.node.init : null;
  }
  return null;
};

/**
 * Every string an expression can evaluate to without running anything: a literal, a template
 * with no substitutions, either branch of a conditional or a logical expression, and what a
 * `const` holds. Whatever depends on a value only known at run time contributes nothing.
 */
const possibleStrings = (context, node, seen = new Set()) => {
  const read = (child) => possibleStrings(context, child, seen);
  if (!node) return [];
  if (TYPE_WRAPPERS.has(node.type)) return read(node.expression);
  switch (node.type) {
    case 'JSXExpressionContainer':
      return read(node.expression);
    case 'Literal':
      return typeof node.value === 'string' ? [node.value] : [];
    case 'TemplateLiteral':
      return node.expressions.length === 0 ? [node.quasis[0].value.cooked] : [];
    case 'ConditionalExpression':
      return [...read(node.consequent), ...read(node.alternate)];
    case 'LogicalExpression':
      return [...read(node.left), ...read(node.right)];
    case 'Identifier':
      if (seen.has(node.name)) return [];
      seen.add(node.name);
      return read(constantValue(context, node));
    default:
      return [];
  }
};

const liveRolesIn = (values) => [
  ...new Set(
    values.flatMap((value) =>
      value
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => LIVE_ROLES.has(token)),
    ),
  ),
];

/**
 * A `role="alert"` or `role="status"` written by hand is a status message built outside the
 * components that draw them. Built by hand, they drifted into bare paragraphs whose only sign of
 * severity was a text colour, which WCAG 1.4.1 rules out: a reader who cannot tell the hues apart
 * cannot tell a failure from a confirmation. `StatusMessage` pairs each severity with an icon of
 * its own, `LoadingStatus` says something is on its way, and `Toast` floats a message over the
 * page. The roles belong to those three alone, and the lint config exempts exactly their files.
 *
 * The role is read wherever it can be known without running the code, so a conditional or a
 * `const` does not hide it. Only the whole tokens count: `alertdialog` is a dialog, not a message.
 * `aria-live` is left alone, because a result count or a hint that updates is a live region
 * without being a status message.
 */
export const noBareStatusRole = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      bare: 'A hand-built live region (role {{role}}): use StatusMessage, LoadingStatus or Toast from @founders-coffee/ui, which pair each severity with an icon rather than a colour alone. (AGENTS.md §8)',
    },
  },
  create: (context) => ({
    JSXAttribute: (node) => {
      if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'role')
        return;
      const roles = liveRolesIn(possibleStrings(context, node.value));
      if (roles.length === 0) return;
      context.report({
        node,
        messageId: 'bare',
        data: { role: roles.join(' or ') },
      });
    },
  }),
};
