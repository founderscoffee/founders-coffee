import { describe, expect, it } from 'vitest';

import fr from '../messages/fr.json';
import { cityInputs } from './city-inputs.js';
import {
  back_to_city,
  city_empty_body,
  city_empty_title,
  city_events_description,
  city_upcoming_title,
  event_meta_description,
  hero_empty_city,
  hero_social_proof,
  hero_waitlist_success,
  host_step1_helper,
  host_step1_helper_market,
  host_venue_search_ph,
  host_venue_search_ph_market,
} from './paraglide/messages.js';

type Variant = { readonly match: Readonly<Record<string, string>> };

type Message = string | readonly Variant[];

const FR = { locale: 'fr' } as const;

const AFTER_A: Readonly<Record<string, string>> = {
  'Le Caire': 'au Caire',
  'Les Eucalyptus': 'aux Eucalyptus',
  'La Mecque': 'à La Mecque',
  Leflaye: 'à Leflaye',
  Alger: 'à Alger',
};

const SENTENCES: readonly {
  readonly key: string;
  readonly render: (city: string) => string;
  readonly expected: (at: string) => string;
}[] = [
  {
    key: 'hero_social_proof, one',
    render: (city) => hero_social_proof({ count: 1, ...cityInputs(city) }, FR),
    expected: (at) => `1 rencontre à venir ${at}`,
  },
  {
    key: 'hero_social_proof, other',
    render: (city) => hero_social_proof({ count: 3, ...cityInputs(city) }, FR),
    expected: (at) => `3 rencontres à venir ${at}`,
  },
  {
    key: 'hero_empty_city',
    render: (city) => hero_empty_city(cityInputs(city), FR),
    expected: (at) => `Pas de rencontres ${at} pour le moment`,
  },
  {
    key: 'hero_waitlist_success',
    render: (city) => hero_waitlist_success(cityInputs(city), FR),
    expected: (at) =>
      `Vous êtes sur la liste ! Nous vous préviendrons dès la première rencontre ${at}.`,
  },
  {
    key: 'city_empty_title',
    render: (city) => city_empty_title(cityInputs(city), FR),
    expected: (at) =>
      `Soyez le premier à organiser une rencontre d’entrepreneurs ${at}`,
  },
  {
    key: 'city_empty_body',
    render: (city) => city_empty_body(cityInputs(city), FR),
    expected: (at) =>
      `Aidez à créer une communauté d’entrepreneurs ${at} en organisant la première rencontre.`,
  },
  {
    key: 'city_upcoming_title',
    render: (city) => city_upcoming_title(cityInputs(city), FR),
    expected: (at) => `Prochaines rencontres ${at}`,
  },
  {
    key: 'city_events_description',
    render: (city) => city_events_description(cityInputs(city), FR),
    expected: (at) =>
      `Découvrez les prochaines rencontres d’entrepreneurs et de la communauté ${at}.`,
  },
  {
    key: 'host_step1_helper',
    render: (city) => host_step1_helper(cityInputs(city), FR),
    expected: (at) =>
      `Choisissez parmi les cafés et espaces de coworking ${at}.`,
  },
  {
    key: 'host_venue_search_ph',
    render: (city) => host_venue_search_ph(cityInputs(city), FR),
    expected: (at) => `Rechercher un café ou un espace de coworking ${at}…`,
  },
  {
    key: 'back_to_city',
    render: (city) => back_to_city(cityInputs(city), FR),
    expected: (at) => `Retour ${at}`,
  },
  {
    key: 'event_meta_description',
    render: (city) =>
      event_meta_description(
        { title: 'Café et code', ...cityInputs(city) },
        FR,
      ),
    expected: (at) =>
      `Rejoignez « Café et code », une rencontre Founders Coffee ${at}.`,
  },
];

const PREPOSITION_BEFORE_CITY = /(?:^|[\s«(])(?:à|de) \{city\}/u;

const FRENCH = fr as Readonly<Record<string, Message | undefined>>;

/** Every French text that puts à or de straight in front of `{city}`, with the key it sits under. */
const prepositionsBeforeCity = (): {
  readonly message: string;
  readonly matchKey: string | null;
  readonly siblings: readonly string[];
}[] =>
  Object.entries(FRENCH).flatMap(([message, value]) => {
    if (value === undefined) return [];
    if (typeof value === 'string')
      return PREPOSITION_BEFORE_CITY.test(value)
        ? [{ message, matchKey: null, siblings: [] }]
        : [];
    return value.flatMap((variant) =>
      Object.entries(variant.match)
        .filter(([, text]) => PREPOSITION_BEFORE_CITY.test(text))
        .map(([matchKey]) => ({
          message,
          matchKey,
          siblings: Object.keys(variant.match),
        })),
    );
  });

describe('French prepositions in front of a city', () => {
  it.each(Object.entries(AFTER_A))(
    'writes %s after à as "%s" in every sentence that names a city',
    (city, at) => {
      for (const sentence of SENTENCES) {
        expect(sentence.render(city), sentence.key).toBe(sentence.expected(at));
      }
    },
  );

  it('leaves the city as written in Arabic and English, which have no article to contract', () => {
    expect(hero_empty_city(cityInputs('القاهرة'), { locale: 'ar' })).toBe(
      'لا توجد لقاءات في القاهرة حاليًا',
    );
    expect(hero_empty_city(cityInputs('Cairo'), { locale: 'en' })).toBe(
      'No meetups in Cairo yet',
    );
    expect(
      hero_empty_city(cityInputs('Les Eucalyptus'), { locale: 'en' }),
      'the Algiers commune is called Les Eucalyptus in English too, and English does not contract it',
    ).toBe('No meetups in Les Eucalyptus yet');
  });

  it('only writes à or de before a city where le and les already have their own sentence', () => {
    const found = prepositionsBeforeCity();
    expect(
      found.length,
      'the catalogue check read nothing, so it would pass on anything',
    ).toBeGreaterThan(0);

    for (const { message, matchKey, siblings } of found) {
      expect(
        matchKey,
        `fr:${message} writes "à {city}" or "de {city}" for every city, so Le Caire reads "à Le Caire". Select on cityArticle and give le and les their own sentence`,
      ).not.toBeNull();
      if (matchKey === null) continue;
      expect(
        matchKey,
        `fr:${message} writes "à {city}" or "de {city}" under ${matchKey}, a variant a city with le or les can land in`,
      ).toContain('cityArticle=*');
      for (const article of ['le', 'les']) {
        expect(
          siblings,
          `fr:${message} has no sentence for a city starting with ${article}, so it falls through to "${matchKey}"`,
        ).toContain(
          matchKey.replace('cityArticle=*', `cityArticle=${article}`),
        );
      }
    }
  });
});

describe('French prepositions in front of a country', () => {
  it('places the venues in the country with en when the host has not picked a city', () => {
    expect(host_step1_helper_market({ market: 'Égypte' }, FR)).toBe(
      'Choisissez parmi les cafés et espaces de coworking en Égypte.',
    );
    expect(host_venue_search_ph_market({ market: 'Algérie' }, FR)).toBe(
      'Rechercher un café ou un espace de coworking en Algérie…',
    );
    expect(
      host_step1_helper_market({ market: 'Egypt' }, { locale: 'en' }),
    ).toBe('Choose from cafés and coworking spaces in Egypt.');
    expect(
      host_venue_search_ph_market({ market: 'مصر' }, { locale: 'ar' }),
    ).toBe('ابحث عن مقهى أو مساحة عمل مشتركة في مصر…');
  });
});
