import {
  baseClass,
  classListVisitors,
  templateTokens,
} from './class-lists.mjs';

/*
 * The classes libs/ui's styles.css grows to a 44px tap target on a touch screen: under
 * `pointer: coarse` each gets a transparent `::after` and the `position: relative` it anchors to.
 */
const TAP_TARGETS = ['btn', 'tap-target'];

const POSITIONS = new Set(['absolute', 'fixed', 'sticky']);

/**
 * The class tokens of every string under `node`, through whatever template, ternary or helper call
 * builds a `className` out of them.
 */
const tokensUnder = (node, visitorKeys) => {
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value.split(/\s+/) : [];
  }
  if (node.type === 'TemplateElement') return templateTokens(node);
  return (visitorKeys[node.type] ?? []).flatMap((key) =>
    [node[key]]
      .flat()
      .filter(Boolean)
      .flatMap((child) => tokensUnder(child, visitorKeys)),
  );
};

/**
 * A `.btn` or a `.tap-target` takes no position of its own. On a touch screen libs/ui's styles.css
 * makes both `relative`, for the `::after` that grows them to a 44px tap target, and does it in the
 * utilities layer after Tailwind's own utilities, so it outranks an `absolute`, `fixed` or `sticky`
 * on the same element. A desktop never matches `pointer: coarse`, so the mistake shows only on a
 * touch screen, where the control drops back into the layout: the meetup map's Directions chip slid
 * half out of the map, and the chat's jump to the latest messages cut the log short by its own
 * height. The position goes on a wrapper, which leaves the control its hit area.
 *
 * A class list is read where local/daisyui-control-size reads one: a `className`, a class helper
 * or a binding named for a class, and a `className` on the design system's `Button` lands on a
 * `.btn`. The strings of one `className` are read together, so a position chosen in one branch of
 * a template meets the control named in another. A position held in a variable goes unseen.
 */
export const noPositionedTapTarget = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      positioned:
        '`{{token}}` positions a `.{{target}}`, whose position libs/ui/src/styles.css claims on a touch screen for its 44px hit area: put the position on a wrapper. (AGENTS.md §8)',
    },
  },
  create: (context) => {
    const attributes = new WeakMap();
    const tokensOf = (attribute) => {
      if (!attributes.has(attribute)) {
        attributes.set(
          attribute,
          tokensUnder(attribute.value, context.sourceCode.visitorKeys),
        );
      }
      return attributes.get(attribute);
    };
    return classListVisitors(context, (node, tokens, found) => {
      const list = found.attribute ? tokensOf(found.attribute) : tokens;
      const target =
        TAP_TARGETS.find((name) => list.includes(name)) ??
        (found.sharedControl === 'btn' ? 'btn' : undefined);
      if (!target) return;
      for (const token of tokens) {
        if (POSITIONS.has(baseClass(token))) {
          context.report({
            node,
            messageId: 'positioned',
            data: { token, target },
          });
        }
      }
    });
  },
};
