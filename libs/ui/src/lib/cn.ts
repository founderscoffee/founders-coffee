import { twMerge } from 'tailwind-merge';

/** Merge class strings (falsy filtered) with tailwind-merge dedup for safe overrides. */
export const cn = (
  ...inputs: ReadonlyArray<string | false | null | undefined>
): string => twMerge(inputs.filter(Boolean).join(' '));
