export const EARTH_RADIUS_METRES = 6_371_000;

/**
 * Metres between two coordinates, over a sphere the size of the Earth.
 *
 * Lives in core rather than beside the venue snapshot that first needed it because the question
 * "did this point move?" is now asked on both sides of the wire: the resolver decides whether to
 * tell anybody, and the edit form has to promise the host the same answer before they save. A
 * browser bundle may not import the domain package at runtime, so a copy in the UI was the only
 * other way to keep those two agreeing — and two copies of a threshold drift apart the first time
 * one of them is tuned.
 */
export const metresBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const VENUE_MOVE_MIN_METRES = 100;

/**
 * Whether a new point is far enough from the old one to be somewhere else.
 *
 * Two separate things stop a notice going out here, and both are about not crying wolf.
 *
 * A meetup that had no point at all has not moved. Most rows predate venue coordinates, so the
 * first time a host opens the map and drops a pin on the café that has been in the title since
 * creation, they are describing where it always was. Telling four people the place changed, when
 * the name on the page is the same name they read when they booked, teaches them that these
 * messages are noise. There is also nothing to compare against: without a previous point no
 * distance exists, so any claim about how far it moved would be invented.
 *
 * Below the threshold it is the same place. The picker makes small adjustments easy — a stray click
 * on the map, or a host dragging the pin from the middle of the building to the actual door — and a
 * hundred metres is roughly the block. Anything inside it leads a person to the same doorway, so
 * the new point is stored without anyone being told; the stored coordinates get more accurate and
 * nobody's phone lights up. The snapshot matcher already treats fifty metres as the same venue, so
 * this sits a little above the distance at which the product stops believing two points are one.
 */
export const hasVenueMoved = (
  from: { latitude: number | null; longitude: number | null },
  to: { latitude: number; longitude: number },
): boolean => {
  if (from.latitude === null || from.longitude === null) return false;
  const distance = metresBetween(
    { latitude: from.latitude, longitude: from.longitude },
    to,
  );
  return distance >= VENUE_MOVE_MIN_METRES;
};
