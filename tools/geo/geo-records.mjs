/**
 * Read the records out of a generated geography module.
 *
 * Three Node tools need this data and none of them can import a `.ts` file, so each matched the
 * source with its own regex. Every one of those pinned the field list, and one pinned the order
 * and the closing brace too, which made adding a field to `GeoCity` a silent break: the match
 * count goes to zero and the tool reports an empty country rather than an error.
 *
 * They also accepted single-quoted strings only. Prettier writes a name containing an apostrophe
 * with double quotes, so `"M'sila"` and `"El-M'ghaier"` were invisible to all three. Those are two
 * of the four featured Algerian cities that have never had a venue snapshot taken, and this is
 * why.
 *
 * Fields are read by name from flat records. Order does not matter, either quote style is
 * accepted, and a field nobody asked for is carried through rather than being fatal.
 */
const FIELD = /([A-Za-z_$][\w$]*):\s*(?:'([^']*)'|"([^"]*)"|(true|false))/g;

const RECORD = /\{[^{}]*\}/g;

const arrayBody = (source, exportName) => {
  const declared = source.indexOf(`export const ${exportName}`);
  if (declared === -1) throw new Error(`${exportName} is not exported here`);
  const assigned = source.indexOf('=', declared);
  if (assigned === -1) throw new Error(`${exportName} is assigned nothing`);
  const open = source.indexOf('[', assigned);
  if (open === -1) throw new Error(`${exportName} opens no array`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    else if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${exportName} never closes its array`);
};

const readRecord = (record) => {
  const fields = {};
  for (const [, key, single, double, bool] of record.matchAll(FIELD)) {
    fields[key] = bool === undefined ? (single ?? double) : bool === 'true';
  }
  return fields;
};

/** Every record in the named exported array, as plain objects keyed by the field names present. */
export const readGeoRecords = (source, exportName) =>
  [...arrayBody(source, exportName).matchAll(RECORD)].map(([record]) =>
    readRecord(record),
  );
