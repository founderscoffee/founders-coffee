export type MapPoint = {
  readonly latitude: number;
  readonly longitude: number;
};

/**
 * A coordinate as a map address writes it: six decimals at most, about ten centimetres on the
 * ground. A point placed by a tap on the map carries fifteen, which only lengthens the address.
 */
export const formatCoordinate = (value: number): string =>
  String(Number(value.toFixed(6)));
