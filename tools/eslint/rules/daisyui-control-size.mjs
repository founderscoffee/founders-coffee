import { baseClass, classListVisitors } from './class-lists.mjs';

/*
 * The one size each daisyUI control takes. A button follows daisyUI's responsive button, xs on a
 * phone and a step larger at every breakpoint up to md, where it stops: lg's 48px and 18px type
 * filled the 64px header and made every button on a laptop as loud as the page's own call to
 * action, and xl was bigger still. A field is small on a phone and medium from `md`, where the
 * layout leaves the phone column.
 */
const BUTTON_SIZES = ['btn-xs', 'sm:btn-sm', 'md:btn-md'];

const controlSizes = (buttonSizes) =>
  new Map([
    ['btn', buttonSizes],
    ['input', ['input-sm', 'md:input-md']],
    ['select', ['select-sm', 'md:select-md']],
    ['textarea', ['textarea-sm', 'md:textarea-md']],
    ['otp', ['otp-sm', 'md:otp-md']],
  ]);

export const CONTROL_SIZES = controlSizes(BUTTON_SIZES);

/*
 * The sizes where a button is a page's call to action rather than one of its controls: the same
 * scale, carried on to lg from 1024px up. The rule takes it with `{ buttons: 'call-to-action' }`,
 * which the workspace config gives only to the files in `CALL_TO_ACTION_BUTTON_FILES`, so every
 * button in those files takes it and none elsewhere can.
 */
export const CALL_TO_ACTION_SIZES = controlSizes([
  ...BUTTON_SIZES,
  'lg:btn-lg',
]);

const FLUID_WIDTH = /^w-(?:full|fit|auto|max|min|\d+\/\d+)$/;

const TYPE_SIZE =
  /^text-(?:(?:xs|sm|base|lg|[2-9]?xl|display(?:-max|-fit)?|h[1-4]|body(?:-lg|-sm)?|label|caption|overline)(?:\/\S+)?|\[[\d.]\S*)$/;

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
 * `className`; otherwise every control named in the list is checked. `scales` is the size each
 * control takes where the list is written.
 */
const findingsIn = (tokens, sizedComponent, scales) => {
  const present = tokens.filter(Boolean);
  const named = [...scales.keys()].filter((component) =>
    present.includes(component),
  );
  const components = sizedComponent ? [sizedComponent] : named;
  return components.flatMap((component) => {
    const sizes = scales.get(component);
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
 * A daisyUI control has one size in this product: every button takes daisyUI's responsive button up
 * to `md`, and every field is small on a phone and medium from `md`. A control sized any other way, or a
 * utility that quietly sets its height, fixed width, font size or a button's padding, holds a size
 * of its own that the scale no longer moves, so it drifts from the controls around it. With
 * `{ buttons: 'call-to-action' }` the buttons go on to `lg` instead, for a page's call to action.
 *
 * A string is read only where it is written as a class list: a `className`, a class helper, or a
 * binding named for a class. The size has to sit in the same string as the control, which is
 * where Tailwind finds it and where a reader looks for it.
 */
export const daisyuiControlSize = {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: { buttons: { enum: ['control', 'call-to-action'] } },
        additionalProperties: false,
      },
    ],
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
    const scales =
      context.options[0]?.buttons === 'call-to-action'
        ? CALL_TO_ACTION_SIZES
        : CONTROL_SIZES;
    return classListVisitors(context, (node, tokens, found) => {
      for (const finding of findingsIn(tokens, found.sharedControl, scales)) {
        context.report({ node, ...finding });
      }
    });
  },
};
