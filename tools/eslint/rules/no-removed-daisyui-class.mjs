const replacedBy = (replacement) => ({ replacement });

const advised = (advice) => ({ advice });

const bordered = (component) =>
  advised(
    `drop it: a DaisyUI 5 ${component} has a border already, and \`${component}-ghost\` takes it away`,
  );

const DISABLED = advised('use the disabled attribute');
const SIZED = advised('set the size with width and height utilities');
const TAB = advised(
  'style the tabs from their container, with `tabs-border`, `tabs-lift` or `tabs-box`',
);
const GONE = advised('DaisyUI 5 has nothing in its place');

const RADIUS_SIDES = [
  '',
  't-',
  'b-',
  'l-',
  'r-',
  'tl-',
  'tr-',
  'bl-',
  'br-',
  's-',
  'e-',
  'ss-',
  'se-',
  'es-',
  'ee-',
];
const RADII = { btn: 'field', badge: 'selector' };

/*
 * Every class DaisyUI 4.12's stylesheet defines that neither DaisyUI 5.6 nor Tailwind has, bar the
 * bare modifier words below, with what takes its place: a replacement is one DaisyUI 5 class,
 * advice covers a removal with no single class to point at. The radius classes are Tailwind's,
 * built for every side from DaisyUI 4's `btn` and `badge` radii, which DaisyUI 5 names `field` and
 * `selector`. The rule's test holds every name here to the Tailwind and DaisyUI 5 build.
 *
 * DaisyUI 4 also used bare words as modifiers. `bordered` and `compact` on a card, and `online`,
 * `offline` and `placeholder` on an avatar, sat on the component's own element, so
 * REMOVED_DAISYUI_MODIFIERS catches them beside it; `horizontal` and `phone` went with `artboard`.
 * The rest sat on a different element, so no one string ties them to DaisyUI, and they are left to
 * review: `active` and `focus` on a menu item (now `menu-active` and `menu-focus`), `hover` on a
 * table row (`row-hover`), and `camera` and `display` inside a phone mockup (`mockup-phone-camera`
 * and `mockup-phone-display`).
 */
export const REMOVED_DAISYUI_CLASSES = new Map([
  [
    'form-control',
    advised(
      'write the column it was, `flex flex-col`, or group the field in a `fieldset`',
    ),
  ],
  ['label-text', advised('use `label`, or style the text with utilities')],
  ['label-text-alt', advised('use `label`, or style the text with utilities')],
  ['input-bordered', bordered('input')],
  ['select-bordered', bordered('select')],
  ['textarea-bordered', bordered('textarea')],
  ['file-input-bordered', bordered('file-input')],
  ['input-disabled', DISABLED],
  ['select-disabled', DISABLED],
  ['textarea-disabled', DISABLED],
  ['file-input-disabled', DISABLED],
  ['card-bordered', replacedBy('card-border')],
  ['card-compact', replacedBy('card-sm')],
  ['card-normal', replacedBy('card-md')],
  ['btm-nav', replacedBy('dock')],
  ['btm-nav-xs', replacedBy('dock-xs')],
  ['btm-nav-sm', replacedBy('dock-sm')],
  ['btm-nav-md', replacedBy('dock-md')],
  ['btm-nav-lg', replacedBy('dock-lg')],
  ['btm-nav-label', replacedBy('dock-label')],
  ['tabs-boxed', replacedBy('tabs-box')],
  ['tabs-bordered', replacedBy('tabs-border')],
  ['tabs-lifted', replacedBy('tabs-lift')],
  ['tab-border', TAB],
  ['tab-border-2', TAB],
  ['tab-border-3', TAB],
  ['tab-border-none', TAB],
  ['tab-rounded-lg', TAB],
  ['tab-rounded-none', TAB],
  ['table-zebra-zebra', replacedBy('table-zebra')],
  ['artboard', SIZED],
  ['artboard-demo', SIZED],
  ['artboard-horizontal', SIZED],
  ...[1, 2, 3, 4, 5, 6].map((size) => [`phone-${size}`, SIZED]),
  ['mask-square', GONE],
  ['mask-parallelogram', GONE],
  ['mask-parallelogram-2', GONE],
  ['mask-parallelogram-3', GONE],
  ['mask-parallelogram-4', GONE],
  ['modal-scroll', GONE],
  ['select-multiple', GONE],
  ['checkbox-mark', GONE],
  ['radio-mark', GONE],
  ['toggle-mark', GONE],
  ['no-animation', GONE],
  ...RADIUS_SIDES.flatMap((side) =>
    Object.entries(RADII).map(([old, now]) => [
      `rounded-${side}${old}`,
      replacedBy(`rounded-${side}${now}`),
    ]),
  ),
]);

export const REMOVED_DAISYUI_MODIFIERS = new Map([
  [
    'card',
    new Map([
      ['bordered', 'card-border'],
      ['compact', 'card-sm'],
    ]),
  ],
  [
    'avatar',
    new Map([
      ['online', 'avatar-online'],
      ['offline', 'avatar-offline'],
      ['placeholder', 'avatar-placeholder'],
    ]),
  ],
]);

/**
 * The class a token names once its variants are set aside: `md:rounded-btn`, `!rounded-btn` and
 * `rounded-btn!` are all `rounded-btn`. A colon inside an arbitrary value, as in
 * `[&:hover]:card`, belongs to the value, so only one outside brackets and parentheses ends a
 * variant.
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
 * The whole class tokens in a stretch of a template. A token that touches a substitution is only
 * part of a class, so the first is dropped after one and the last before one.
 */
const templateTokens = (element) => {
  const tokens = (element.value.cooked ?? '').split(/\s+/);
  const isFirst = element.parent.quasis[0] === element;
  return tokens.slice(isFirst ? 0 : 1, element.tail ? undefined : -1);
};

/**
 * One report for each removed class in a class list, in the order they are written: a removed
 * class on its own, or a removed modifier beside the component it modified.
 */
const findingsIn = (tokens) => {
  const classes = new Set(tokens.filter(Boolean).map(baseClass));
  return [...classes].flatMap((name) => {
    if (REMOVED_DAISYUI_CLASSES.has(name)) {
      const { replacement, advice } = REMOVED_DAISYUI_CLASSES.get(name);
      const fix = replacement ? `use \`${replacement}\`` : advice;
      return [{ messageId: 'removed', data: { name, fix } }];
    }
    return [...REMOVED_DAISYUI_MODIFIERS]
      .filter(
        ([component, modifiers]) =>
          classes.has(component) && modifiers.has(name),
      )
      .map(([component, modifiers]) => ({
        messageId: 'modifier',
        data: { component, modifier: name, replacement: modifiers.get(name) },
      }));
  });
};

/**
 * A DaisyUI 4 class looks like styling to anyone who knows DaisyUI 4, but this project builds with
 * DaisyUI 5, where it generates nothing and nothing warns. `form-control` was a flex column in
 * DaisyUI 4; written on ten fields here, it left the host wizard's character counters at the start
 * of the line and each error running on from its counter.
 *
 * Every string, and every static stretch of a template, is read as a class list, so a class is
 * caught wherever it is written: in `className`, in `cn` and `cva`, in a constant or in a helper
 * that returns one. Only whole tokens count: `input-bordered-note` passes, and so does a class
 * glued to a substitution. A modifier is caught when its component is in the same string.
 */
export const noRemovedDaisyuiClass = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      removed:
        '`{{name}}` is a DaisyUI 4 class that DaisyUI 5 does not have, so it styles nothing: {{fix}}. (AGENTS.md §8)',
      modifier:
        '`{{modifier}}` beside `{{component}}` is a DaisyUI 4 modifier that DaisyUI 5 does not have, so it styles nothing: use `{{replacement}}`. (AGENTS.md §8)',
    },
  },
  create: (context) => {
    const check = (node, tokens) => {
      for (const finding of findingsIn(tokens)) {
        context.report({ node, ...finding });
      }
    };
    return {
      Literal: (node) => {
        if (typeof node.value !== 'string') return;
        check(node, node.value.split(/\s+/));
      },
      TemplateElement: (node) => check(node, templateTokens(node)),
    };
  },
};
