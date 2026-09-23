import {
  countUpcomingByCity,
  countUpcomingByState,
  listUpcomingCityHosts,
  type Db,
} from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

import { groupCityHosts, NO_CITY_HOSTS, type CityHosts } from './city-hosts.js';

export interface TrendingCity extends CityHosts {
  readonly city: geo.GeoCity;
  readonly count: number;
}

export interface TrendingState {
  readonly state: geo.GeoState | null;
  readonly cities: readonly TrendingCity[];
}

export interface TrendingSection {
  readonly variant: 'major' | 'active';
  readonly groups: readonly TrendingState[];
}

const TRENDING_CITY_CAP = 11;
const WARM_STATE_CAP = 3;
const WARM_CITY_CAP = 8;

const COLD_PRIORITY_SLUGS: Readonly<Record<string, readonly string[]>> = {
  DZ: [
    'algiers',
    'oran',
    'constantine',
    'bejaia',
    'setif',
    'annaba',
    'blida',
    'batna',
    'tlemcen',
    'tizi-ouzou',
    'djelfa',
    'sidi-bel-abbes',
    'biskra',
    'tebessa',
    'skikda',
    'tiaret',
    'bechar',
    'mostaganem',
  ],
  EG: [
    'cairo',
    'alexandria',
    'giza',
    'mansoura',
    'tanta',
    'hurghada',
    'sharm-el-shaikh',
    'aswan',
    'luxor',
    'ismailia',
    'suez',
    'zagazig',
    'damanhour',
    'minya',
  ],
  SA: [
    'riyadh',
    'makkah',
    'dammam',
    'madinah',
    'tabuk',
    'abha',
    'buraidah',
    'jazan',
    'hail',
    'najran',
    'bahah',
    'arar',
    'sakaka',
  ],
};

const allMarketCities = (marketCode: string): readonly geo.GeoCity[] =>
  geo
    .getStates(marketCode)
    .flatMap((state) => geo.getCities(marketCode, state.code));

const orderedLandingCities = (marketCode: string): readonly geo.GeoCity[] => {
  const featured = geo.getFeaturedCities(marketCode);
  const featuredCodes = new Set(featured.map((city) => city.code));
  const candidates = [
    ...featured,
    ...allMarketCities(marketCode).filter(
      (city) => !featuredCodes.has(city.code),
    ),
  ];
  const priority = new Map(
    (COLD_PRIORITY_SLUGS[marketCode] ?? []).map((slug, i) => [slug, i]),
  );

  return candidates.sort(
    (a, b) =>
      (priority.get(a.slug) ?? 1_000) - (priority.get(b.slug) ?? 1_000) ||
      Number(b.featured) - Number(a.featured) ||
      a.name.localeCompare(b.name),
  );
};

const coldMajorCities = (marketCode: string): TrendingSection => {
  const cities = orderedLandingCities(marketCode)
    .slice(0, TRENDING_CITY_CAP)
    .map((city) => ({ city, count: 0, ...NO_CITY_HOSTS }));
  if (cities.length === 0) return { variant: 'major', groups: [] };
  return { variant: 'major', groups: [{ state: null, cities }] };
};

const warmActiveCities = (
  marketCode: string,
  stateCounts: Record<string, number>,
  cityCounts: Record<string, number>,
  cityHosts: ReadonlyMap<string, CityHosts>,
): TrendingSection => {
  const topStates = geo
    .getStates(marketCode)
    .map((state) => ({ state, count: stateCounts[state.code] ?? 0 }))
    .filter((s) => s.count > 0)
    .sort(
      (a, b) => b.count - a.count || a.state.code.localeCompare(b.state.code),
    )
    .slice(0, WARM_STATE_CAP);

  const groups = topStates.map(({ state }) => {
    const cities = geo
      .getCities(marketCode, state.code)
      .map((city) => ({
        city,
        count: cityCounts[city.code] ?? 0,
        ...(cityHosts.get(city.code) ?? NO_CITY_HOSTS),
      }))
      .filter((c) => c.count > 0)
      .sort(
        (a, b) => b.count - a.count || a.city.name.localeCompare(b.city.name),
      )
      .slice(0, WARM_CITY_CAP);
    return { state, cities };
  });

  const active = groups.filter((g) => g.cities.length > 0);
  const boundedActive: TrendingState[] = [];
  let activeCityCount = 0;
  for (const group of active) {
    const remaining = TRENDING_CITY_CAP - activeCityCount;
    if (remaining <= 0) break;
    const cities = group.cities.slice(0, remaining);
    if (cities.length === 0) continue;
    boundedActive.push({ state: group.state, cities });
    activeCityCount += cities.length;
  }
  const taken = new Set(
    boundedActive.flatMap((g) => g.cities.map(({ city }) => city.code)),
  );
  const pioneer = orderedLandingCities(marketCode)
    .filter((city) => !taken.has(city.code))
    .slice(0, Math.max(0, TRENDING_CITY_CAP - activeCityCount))
    .map((city) => ({ city, count: 0, ...NO_CITY_HOSTS }));

  return {
    variant: 'active',
    groups:
      pioneer.length === 0
        ? boundedActive
        : [...boundedActive, { state: null, cities: pioneer }],
  };
};

/**
 * Browse section for a market landing. Active cities lead the fixed landing grid, followed by
 * ordered city candidates until all 11 cards are filled. An active city carries the hosts of its
 * upcoming meetups; a city with nothing on has none to carry.
 */
export const resolveTrendingStates = async (
  db: Db,
  marketCode: string,
): Promise<TrendingSection> => {
  const [stateCounts, cityCounts, cityHosts] = await Promise.all([
    countUpcomingByState(db, marketCode),
    countUpcomingByCity(db, marketCode),
    listUpcomingCityHosts(db, marketCode),
  ]);
  const totalUpcoming = Object.values(cityCounts).reduce(
    (sum, n) => sum + n,
    0,
  );
  if (totalUpcoming === 0) return coldMajorCities(marketCode);
  return warmActiveCities(
    marketCode,
    stateCounts,
    cityCounts,
    groupCityHosts(cityHosts),
  );
};
