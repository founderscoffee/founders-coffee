/*
 * The one size each daisyUI control takes. A button follows daisyUI's responsive button, xs on a
 * phone and a step larger at every breakpoint up to lg, where it stops: xl's 56px and 22px type
 * were too big on a laptop. A field is small on a phone and medium from `md`, where the layout
 * leaves the phone column.
 */
export const CONTROL_SIZES = new Map([
  ['btn', ['btn-xs', 'sm:btn-sm', 'md:btn-md', 'lg:btn-lg']],
  ['input', ['input-sm', 'md:input-md']],
  ['select', ['select-sm', 'md:select-md']],
  ['textarea', ['textarea-sm', 'md:textarea-md']],
  ['otp', ['otp-sm', 'md:otp-md']],
]);

/*
 * The shared components that write a control's class themselves, so a `className` passed to one
 * can only add to a control that is already sized. They count only when imported from the design
 * system: React Email has a `Button` of its own.
 */
const SIZED_COMPONENTS = new Map([
  ['Button', 'btn'],
  ['Input', 'input'],
  ['Select', 'select'],
]);

const DESIGN_SYSTEM =
  /^@founders-coffee\/ui$|\/(?:Button|Input|Select)(?:\.js)?$/;

const CLASS_HELPERS = new Set(['cn', 'cva', 'clsx', 'cx']);

const FLUID_WIDTH = /^w-(?:full|fit|auto|max|min|\d+\/\d+)$/;

const TYPE_SIZE =
  /^text-(?:(?:xs|sm|base|lg|[2-9]?xl|display(?:-max|-fit)?|h[1-4]|body(?:-lg|-sm)?|label|caption|overline)(?:\/\S+)?|\[[\d.]\S*)$/;

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
const baseClass = (token) => {
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
 * What a utility sets that the control's size already sets, or nothing when it leaves the size
 * alone. Padding is part of a button's size, not of a field's: daisyUI pads every field alike and
 * a field makes room for an icon with it.
 */
const overrideOf = (component, name) => {
  if (/^(?:h|min-h|max-h)-/.test(name)) return 'a height';
  if (/^size-/.test(name)) return 'a height and a width';
  if (/^w-/.test(name) && !FLUID_WIDTH.test(name)) return 'a fixed width';
  if (TYPE_SIZE.test(name)) return 'a font size';
  if (component === 'btn' && /^(?:p|px|py|ps|pe|pt|pb)-/.test(name)) {
    return 'padding';
  }
  return undefined;
};

const isSizeOf = (component, name) =>
  new RegExp(`^${component}-(?:xs|sm|md|lg|xl)$`).test(name);

/**
 * One report for each way a class list sizes a control other than the one way: a size missing
 * from the scale, a size from outside it, and a utility that sets part of what the size sets.
 * `sizedComponent` is the control a shared component has already sized, when the list is its
 * `className`; otherwise every control named in the list is checked.
 */
const findingsIn = (tokens, sizedComponent) => {
  const present = tokens.filter(Boolean);
  const named = [...CONTROL_SIZES.keys()].filter((component) =>
    present.includes(component),
  );
  const components = sizedComponent ? [sizedComponent] : named;
  return components.flatMap((component) => {
    const sizes = CONTROL_SIZES.get(component);
    const scale = sizes.join(' ');
    const missing = sizedComponent
      ? []
      : sizes.filter((size) => !present.includes(size));
    const foreign = present.filter(
      (token) =>
        isSizeOf(component, baseClass(token)) && !sizes.includes(token),
    );
    const overrides = present.flatMap((token) => {
      const what = overrideOf(component, baseClass(token));
      return what ? [{ token, what }] : [];
    });
    return [
      ...(missing.length > 0
        ? [
            {
              messageId: 'missing',
              data: { component, scale, missing: missing.join(' ') },
            },
          ]
        : []),
      ...foreign.map((token) => ({
        messageId: 'foreign',
        data: { component, scale, token },
      })),
      ...overrides.map(({ token, what }) => ({
        messageId: 'override',
        data: { component, scale, token, what },
      })),
    ];
  });
};

/**
 * The whole class tokens in a stretch of a template. A token that touches a substitution is only
 * part of a class, so the first is dropped after one and the last before one.
 */
const templateTokens = (element) => {
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
 * held anywhere else is left alone. For a `className` on a shared component, found by its local
 * name in `sized`, the control that component has already sized comes back with the answer.
 */
const classContext = (ancestors, sized) => {
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
      sizedComponent:
        name.type === 'JSXIdentifier' ? sized.get(name.name) : undefined,
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
 * A daisyUI control has one size in this product: every button takes daisyUI's responsive button up
 * to `lg`, and every field is small on a phone and medium from `md`. A control sized any other way, or a
 * utility that quietly sets its height, fixed width, font size or a button's padding, holds a size
 * of its own that the scale no longer moves, so it drifts from the controls around it.
 *
 * A string is read only where it is written as a class list: a `className`, a class helper, or a
 * binding named for a class. The size has to sit in the same string as the control, which is
 * where Tailwind finds it and where a reader looks for it.
 */
export const daisyuiControlSize = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      missing:
        '`{{component}}` takes one size, `{{scale}}`, and this class list is missing `{{missing}}`. (AGENTS.md §8)',
      foreign:
        '`{{token}}` sizes `{{component}}` outside its one size, `{{scale}}`: drop it. (AGENTS.md §8)',
      override:
        '`{{token}}` sets {{what}} that `{{component}}` takes from its size, `{{scale}}`: drop it. (AGENTS.md §8)',
    },
  },
  create: (context) => {
    const sized = new Map();
    const check = (node, tokens) => {
      const found = classContext(context.sourceCode.getAncestors(node), sized);
      if (!found) return;
      for (const finding of findingsIn(tokens, found.sizedComponent)) {
        context.report({ node, ...finding });
      }
    };
    return {
      ImportDeclaration: (node) => {
        if (!DESIGN_SYSTEM.test(node.source.value)) return;
        for (const specifier of node.specifiers) {
          const control = SIZED_COMPONENTS.get(specifier.imported?.name);
          if (control) sized.set(specifier.local.name, control);
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
  },
};
