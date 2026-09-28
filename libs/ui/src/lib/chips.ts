/**
 * The chips selected once `option` is tapped: taken out when it was on, added at the end when it
 * was off and `max` leaves room for it, and otherwise left as they were.
 */
export const toggleChip = <T extends string>(
  values: readonly T[],
  option: T,
  max: number,
): T[] =>
  values.includes(option)
    ? values.filter((value) => value !== option)
    : values.length >= max
      ? [...values]
      : [...values, option];
