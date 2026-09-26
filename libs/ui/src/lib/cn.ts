import { extendTailwindMerge } from 'tailwind-merge';

const TYPE_SIZES = [
  'display',
  'display-max',
  'h1',
  'h2',
  'h3',
  'h4',
  'body-lg',
  'body',
  'body-sm',
  'label',
  'caption',
  'overline',
];

const merge = extendTailwindMerge({ extend: { theme: { text: TYPE_SIZES } } });

/**
 * Merge class strings (falsy filtered) with tailwind-merge dedup for safe overrides.
 *
 * tailwind-merge knows Tailwind's own sizes (`text-sm`, `text-lg`) and takes any other `text-*` for
 * a colour. The theme names its type scale instead (`text-body-sm`, `text-caption`), so without
 * being told, `cn('text-body-sm text-neutral')` returned `text-neutral` and the size was lost, and
 * the only sign was text rendering at whatever size it inherited. Teaching it the scale keeps a size
 * beside a colour and still lets a later size, or a later colour, replace an earlier one.
 */
export const cn = (
  ...inputs: ReadonlyArray<string | false | null | undefined>
): string => merge(inputs.filter(Boolean).join(' '));
