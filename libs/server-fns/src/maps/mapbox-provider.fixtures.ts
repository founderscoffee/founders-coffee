import type { MapProviderLocation } from './provider.js';

const location: MapProviderLocation = {
  marketCode: 'DZ',
  city: {
    code: '1',
    name: 'Algiers',
    nameAr: 'الجزائر',
    slug: 'algiers',
    stateCode: '01',
    featured: true,
  },
  locale: 'ar',
};

const cityFeature = {
  type: 'Feature',
  bbox: [2.9, 36.6, 3.3, 36.9],
  geometry: { type: 'Point', coordinates: [3.0588, 36.7538] },
  properties: {
    mapbox_id: 'city-algiers',
    feature_type: 'place',
    name: 'Algiers',
    context: { country: { name: 'Algeria', country_code: 'DZ' } },
  },
};

const cafeFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [3.06, 36.75] },
  properties: {
    mapbox_id: 'poi-cafe',
    feature_type: 'poi',
    name: 'Café des Fondateurs',
    full_address: '12 Rue des Entrepreneurs, Alger',
    maki: 'cafe',
    poi_category_ids: ['cafe', 'coffee'],
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Algiers' },
    },
  },
};

const localityFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [3.05, 36.74] },
  properties: {
    mapbox_id: 'place-algiers',
    feature_type: 'place',
    name: 'Algiers',
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Algiers' },
    },
  },
};

const outsideCafeFeature = {
  ...cafeFeature,
  geometry: { type: 'Point', coordinates: [-0.63, 35.69] },
  properties: {
    ...cafeFeature.properties,
    mapbox_id: 'poi-oran-cafe',
    name: 'Oran Café',
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Oran' },
    },
  },
};

const coffeeRetailerFeature = {
  ...cafeFeature,
  properties: {
    ...cafeFeature.properties,
    mapbox_id: 'poi-coffee-retailer',
    name: 'Coffee Equipment Store',
    maki: 'shop',
    poi_category_ids: ['coffee_shop_supplies'],
  },
};

const addressFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [3.0601, 36.7501] },
  properties: {
    mapbox_id: 'address-yousfi',
    feature_type: 'address',
    name: '15 Rue Yousfi Mohamed',
    full_address: '15 Rue Yousfi Mohamed, Alger',
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Algiers' },
    },
  },
};

const response = (features: readonly unknown[]): Response =>
  Response.json({ type: 'FeatureCollection', features });

const queuedFetcher = (
  payloads: readonly (readonly unknown[])[],
): { fetcher: (input: string) => Promise<Response>; requests: string[] } => {
  const requests: string[] = [];
  let index = 0;
  return {
    requests,
    fetcher: async (input) => {
      requests.push(input);
      return response(payloads[index++] ?? []);
    },
  };
};

export {
  location,
  cityFeature,
  cafeFeature,
  localityFeature,
  outsideCafeFeature,
  coffeeRetailerFeature,
  addressFeature,
  response,
  queuedFetcher,
};
