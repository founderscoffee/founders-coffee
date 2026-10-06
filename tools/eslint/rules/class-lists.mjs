/*
 * The shared components that write a control's class themselves, so a `className` passed to one
 * lands on that control. They count only when imported from the design system: React Email has a
 * `Button` of its own.
 */
const SHARED_CONTROLS = new Map([
  ['Button', 'btn'],
  ['Input', 'input'],
  ['Select', 'select'],
]);

const DESIGN_SYSTEM =
  /^@founders-coffee\/ui$|\/(?:Button|Input|Select)(?:\.js)?$/;

const CLASS_HELPERS = new Set(['cn', 'cva', 'clsx', 'cx']);

const WRAPPERS = new Set([
  'TemplateLiteral',
  'ConditionalExpression',
  'LogicalExpression',
  'BinaryExpression',
  'ArrayExpression',
  'JSXExpressionContainer',
  'TSAsExpression',
  'TSSatisfiesExpression',
]);

/**
 * The class a token names once its variants are set aside: `md:h-12`, `!h-12` and `h-12!` are all
 * `h-12`. A colon inside an arbitrary value belongs to the value, so only one outside brackets and
 * parentheses ends a variant.
 */
export const baseClass = (token) => {
  let depth = 0;
  let start = 0;
  [...token].forEach((character, index) => {
    if (character === '[' || character === '(') depth += 1;
    else if (character === ']' || character === ')') depth -= 1;
    else if (character === ':' && depth === 0) start = index + 1;
  });
  return token.slice(start).replace(/^!|!$/g, '');
};

/**
 * The whole class tokens in a stretch of a template. A token that touches a substitution is only
 * part of a class, so the first is dropped after one and the last before one.
 */
export const templateTokens = (element) => {
  const tokens = (element.value.cooked ?? '').split(/\s+/);
  const isFirst = element.parent.quasis[0] === element;
  return tokens.slice(isFirst ? 0 : 1, element.tail ? undefined : -1);
};

const nameOf = (node) =>
  node?.type === 'Identifier'
    ? node.name
    : node?.type === 'Literal'
      ? String(node.value)
      : undefined;

/**
 * What holds a string once the expressions it only passes through are set aside: a ternary, a
 * template, a `&&`, an array or a JSX container hands the string on unchanged.
 */
const holderOf = (ancestors, from) => {
  let index = from;
  while (index >= 0 && WRAPPERS.has(ancestors[index].type)) index -= 1;
  return { holder: ancestors[index], index };
};

/**
 * Whether a string is written as a class list: in a `className`, in a class helper, or held by a
 * binding or key whose name says it is a class. Prose says `input` and `select` too, so a string
 * held anywhere else is left alone. A string in a `className` comes back with its attribute, and
 * for one on a shared component, found by its local name in `shared`, with the control that
 * component writes.
 */
const classContext = (ancestors, shared) => {
  const inner = holderOf(ancestors, ancestors.length - 1);
  const isHelperCall =
    inner.holder?.type === 'CallExpression' &&
    CLASS_HELPERS.has(nameOf(inner.holder.callee));
  const holder = isHelperCall
    ? holderOf(ancestors, inner.index - 1).holder
    : inner.holder;
  if (holder?.type === 'JSXAttribute') {
    if (holder.name.name !== 'className') return undefined;
    const { name } = holder.parent;
    return {
      attribute: holder,
      sharedControl:
        name.type === 'JSXIdentifier' ? shared.get(name.name) : undefined,
    };
  }
  if (isHelperCall) return {};
  const isNamedClass =
    (holder?.type === 'VariableDeclarator' &&
      /class/i.test(nameOf(holder.id) ?? '')) ||
    (holder?.type === 'Property' && /class/i.test(nameOf(holder.key) ?? ''));
  return isNamedClass ? {} : undefined;
};

/**
 * The visitors that hand `onClassList` each string a file writes as a class list, with its class
 * tokens and what `classContext` says of it: every string literal but an import's source, and every
 * stretch of a template. An import from the design system is noted on the way, so a `className`
 * given to a shared component later in the file is read as its control's.
 */
export const classListVisitors = (context, onClassList) => {
  const shared = new Map();
  const check = (node, tokens) => {
    const found = classContext(context.sourceCode.getAncestors(node), shared);
    if (found) onClassList(node, tokens, found);
  };
  return {
    ImportDeclaration: (node) => {
      if (!DESIGN_SYSTEM.test(node.source.value)) return;
      for (const specifier of node.specifiers) {
        const control = SHARED_CONTROLS.get(specifier.imported?.name);
        if (control) shared.set(specifier.local.name, control);
      }
    },
    Literal: (node) => {
      if (
        typeof node.value !== 'string' ||
        node.parent.type === 'ImportDeclaration'
      ) {
        return;
      }
      check(node, node.value.split(/\s+/));
    },
    TemplateElement: (node) => check(node, templateTokens(node)),
  };
};
