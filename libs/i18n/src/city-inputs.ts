export type CityArticle = 'le' | 'les' | 'none';

export type CityInputs = {
  readonly city: string;
  readonly cityArticle: CityArticle;
  readonly cityAfterArticle: string;
};

const CONTRACTING_ARTICLE = /^(Les?) (.+)$/u;

/**
 * The inputs a message needs to put a preposition in front of a city's name.
 *
 * French merges à and de into the article a place name starts with: a meetup is "au Caire", never
 * "à Le Caire", and "aux Eucalyptus", never "à Les Eucalyptus". The article belongs to the name as
 * the datasets hold it, so no single sentence can put à in front of every city. The French catalogue
 * instead selects on `cityArticle` and writes the merged preposition itself, in front of
 * `cityAfterArticle`. Only le and les merge. La and l’ stay as written ("à La Mecque"), so those
 * names take the default sentence along with every name that has no article at all.
 *
 * Arabic and English sentences take `city` and ignore the other two, so an English page still
 * writes "in Les Eucalyptus".
 */
export const cityInputs = (city: string): CityInputs => {
  const match = CONTRACTING_ARTICLE.exec(city);
  if (!match) return { city, cityArticle: 'none', cityAfterArticle: city };
  const [, article, afterArticle] = match;
  return {
    city,
    cityArticle: article === 'Le' ? 'le' : 'les',
    cityAfterArticle: afterArticle,
  };
};
