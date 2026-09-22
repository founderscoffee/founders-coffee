import { getEventCard, type Db } from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

export type EventCard = {
  readonly title: string;
  readonly startsAt: Date;
  readonly version: number;
  readonly hostName: string;
  readonly timezone: string;
  readonly cityName: string;
  readonly cityNameAr: string;
};

/**
 * What a social card is allowed to say about a meetup, or nothing.
 *
 * Only a published meetup has a card. A draft has a working title its host has not shown anyone,
 * and a cancelled one should not keep advertising itself; the address of either is guessable from
 * a link that was shared and then withdrawn, so the answer here is the same as for a meetup that
 * never existed — the caller cannot tell the three apart, and draws the house picture for all of
 * them.
 *
 * The city is named from the geo tables rather than stored on the row, which is where every other
 * public read gets it, and both spellings come back because the card is drawn in whichever
 * language the link was shared in.
 */
export const readEventCard = async (
  db: Db,
  id: string,
): Promise<EventCard | null> => {
  const card = await getEventCard(db, id);
  if (!card || card.status !== 'published') return null;
  const city = geo.findCity(card.marketCode, card.cityCode);
  return {
    title: card.title,
    startsAt: card.startsAt,
    version: card.version,
    hostName: card.hostName,
    timezone: card.timezone,
    cityName: city?.name ?? card.cityCode,
    cityNameAr: city?.nameAr ?? city?.name ?? card.cityCode,
  };
};
