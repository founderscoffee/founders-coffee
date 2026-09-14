import {
  countUpcomingByCity,
  countUpcomingByState,
  type Db,
} from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

export interface TrendingCity {
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

const COLD_MAJOR_CITY_CAP = 18;
const WARM_STATE_CAP = 3;
const WARM_CITY_CAP = 8;
const WARM_CITY_TOTAL_CAP = 4;

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

const coldMajorCities = (marketCode: string): TrendingSection => {
  const priority = new Map(
    (COLD_PRIORITY_SLUGS[marketCode] ?? []).map((slug, i) => [slug, i]),
  );
  const cities = [...geo.getFeaturedCities(marketCode)]
    .map((city) => ({ city, count: 0 }))
    .sort(
      (a, b) =>
        (priority.get(a.city.slug) ?? 1_000) -
          (priority.get(b.city.slug) ?? 1_000) ||
        a.city.name.localeCompare(b.city.name),
    )
    .slice(0, COLD_MAJOR_CITY_CAP);
  if (cities.length === 0) return { variant: 'major', groups: [] };
  return { variant: 'major', groups: [{ state: null, cities }] };
};

const warmActiveCities = (
  marketCode: string,
  stateCounts: Record<string, number>,
  cityCounts: Record<string, number>,
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
      .map((city) => ({ city, count: cityCounts[city.code] ?? 0 }))
      .filter((c) => c.count > 0)
      .sort(
        (a, b) => b.count - a.count || a.city.name.localeCompare(b.city.name),
      )
      .slice(0, WARM_CITY_CAP);
    return { state, cities };
  });

  const active = groups.filter((g) => g.cities.length > 0);
  const taken = new Set(
    active.flatMap((g) => g.cities.map(({ city }) => city.code)),
  );
  const priority = new Map(
    (COLD_PRIORITY_SLUGS[marketCode] ?? []).map((slug, i) => [slug, i]),
  );
  const pioneer = [...geo.getFeaturedCities(marketCode)]
    .filter((city) => !taken.has(city.code))
    .sort(
      (a, b) =>
        (priority.get(a.slug) ?? 1_000) - (priority.get(b.slug) ?? 1_000) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, Math.max(0, WARM_CITY_TOTAL_CAP - taken.size))
    .map((city) => ({ city, count: 0 }));

  return {
    variant: 'active',
    groups:
      pioneer.length === 0
        ? active
        : [...active, { state: null, cities: pioneer }],
  };
};

/**
 * Browse section for a market landing. Cold markets show major cities; warm markets show active
 * states and cities followed by a small pioneer recruitment surface.
 */
export const resolveTrendingStates = async (
  db: Db,
  marketCode: string,
): Promise<TrendingSection> => {
  const [stateCounts, cityCounts] = await Promise.all([
    countUpcomingByState(db, marketCode),
    countUpcomingByCity(db, marketCode),
  ]);
  const totalUpcoming = Object.values(cityCounts).reduce(
    (sum, n) => sum + n,
    0,
  );
  if (totalUpcoming === 0) return coldMajorCities(marketCode);
  return warmActiveCities(marketCode, stateCounts, cityCounts);
};
