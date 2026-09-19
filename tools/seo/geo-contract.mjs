import { soleAlternateLocale } from './routes.mjs';

const LOCALES = new Set(['ar', 'fr', 'en']);

const PRIMARY_TYPES = {
  company: 'WebPage',
  city: 'CollectionPage',
  event: 'Event',
  market: 'CollectionPage',
};
const PRIVATE_KEYS = new Set(['email', 'phone', 'hostid', 'rsvps']);

const jsonLdScripts = (body) => {
  const schemas = [];
  for (const match of body.matchAll(
    /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/giu,
  )) {
    try {
      const value = JSON.parse(match[1]);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        schemas.push(value);
      }
    } catch {
      schemas.push(null);
    }
  }
  return schemas;
};

const visibleText = (body) =>
  body
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&nbsp;/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const schemaType = (schema) =>
  schema && typeof schema['@type'] === 'string' ? schema['@type'] : null;

const hasPrivateKey = (value) => {
  if (Array.isArray(value)) return value.some((item) => hasPrivateKey(item));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      PRIVATE_KEYS.has(key.toLowerCase()) || hasPrivateKey(nested),
  );
};

export const inspectGeoDocument = ({ path, type, body, canonical }) => {
  const failures = [];
  const headings = [...body.matchAll(/<h([1-6])\b/giu)].map(
    (match) => match[1],
  );
  if (headings[0] !== '1') failures.push('first heading is not an h1');
  if (!headings.includes('2')) failures.push('no h2 section heading found');
  if (headings.some((level, index) => index > 0 && level === '1'))
    failures.push('document contains multiple h1 headings');

  const schemas = jsonLdScripts(body);
  if (schemas.some((schema) => schema === null))
    failures.push('contains invalid JSON-LD');
  const types = schemas.map(schemaType).filter(Boolean);
  for (const typeName of new Set(types)) {
    if (types.filter((type) => type === typeName).length > 1)
      failures.push(`contains duplicate ${typeName} JSON-LD entities`);
  }

  const primaryType = PRIMARY_TYPES[type];
  const primary = schemas.find((schema) => schemaType(schema) === primaryType);
  if (!primary) {
    failures.push(`missing ${primaryType} JSON-LD entity`);
    return failures;
  }
  if (typeof canonical !== 'string' || typeof primary.url !== 'string')
    failures.push(`${primaryType} JSON-LD or canonical URL is missing`);
  else if (primary.url !== canonical)
    failures.push(`${primaryType} JSON-LD URL does not match canonical`);

  const locale =
    soleAlternateLocale(body) ?? path.split('/').filter(Boolean)[0];
  if (
    typeof primary.inLanguage !== 'string' ||
    !LOCALES.has(primary.inLanguage)
  )
    failures.push(`${primaryType} JSON-LD has no supported inLanguage`);
  if (type !== 'event' && primary.inLanguage !== locale)
    failures.push(`${primaryType} JSON-LD inLanguage does not match the route`);

  const text = visibleText(body);
  const visibleName =
    type === 'city' && typeof primary.name === 'string'
      ? primary.name.split(' · ', 1)[0]
      : primary.name;
  if (typeof visibleName !== 'string' || !visibleName.trim())
    failures.push(`${primaryType} JSON-LD name is missing`);
  else if (!text.includes(visibleName))
    failures.push(`${primaryType} name is not visible in the document`);
  if (
    type === 'event' &&
    primary.organizer &&
    typeof primary.organizer.name === 'string' &&
    !text.includes(primary.organizer.name)
  )
    failures.push('event organizer is not visible in the document');

  if (hasPrivateKey(primary))
    failures.push('primary JSON-LD contains private fields');
  return failures;
};
