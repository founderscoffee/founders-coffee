import type { UpcomingCityHost } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

export interface TrendingHost {
  readonly name: string;
  readonly photoAssetId: string | null;
}

export interface CityHosts {
  readonly hosts: readonly TrendingHost[];
  readonly hostCount: number;
}

const FACES_PER_CITY = 3;

export const NO_CITY_HOSTS: CityHosts = { hosts: [], hostCount: 0 };

/**
 * The faces each city card shows, and how many hosts they stand for, keyed by city code.
 *
 * `rows` arrive the way {@link listUpcomingCityHosts} returns them, soonest host first within a
 * city, and the first three a card can draw are its faces. A card draws a host by the name the
 * event cards print, so a host without one is passed over for the next rather than drawn blank.
 * They still count: `hostCount` is every host in the city, drawn or not, so the counter after the
 * faces stands for everyone they leave out.
 */
export const groupCityHosts = (
  rows: readonly UpcomingCityHost[],
): ReadonlyMap<string, CityHosts> => {
  const byCity = new Map<
    string,
    { hosts: TrendingHost[]; hostCount: number }
  >();
  for (const row of rows) {
    const city = byCity.get(row.cityCode) ?? { hosts: [], hostCount: 0 };
    byCity.set(row.cityCode, city);
    city.hostCount += 1;
    const name = profile.safeProfileDisplayName(row.name);
    if (name && city.hosts.length < FACES_PER_CITY)
      city.hosts.push({ name, photoAssetId: row.photoAssetId });
  }
  return byCity;
};
