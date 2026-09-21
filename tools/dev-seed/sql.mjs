/**
 * Render one value as a SQLite literal.
 *
 * `wrangler d1 execute` takes SQL text and offers no way to bind a parameter, so the seed has to
 * put its values into the statement. Everything routes through here rather than through template
 * interpolation at each call site, which is what keeps §11's rule meaningful: one function to read,
 * one function to test, and no way to reach the statement without passing through it.
 *
 * @param {string|number|boolean|null|undefined} value the value to render.
 * @returns {string} a SQLite literal.
 */
export const literal = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error(`refusing to render ${value} as SQL`);
    return String(value);
  }
  if (typeof value !== 'string')
    throw new Error(`refusing to render ${typeof value} as SQL`);
  return `'${value.replaceAll("'", "''")}'`;
};

const identifier = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name))
    throw new Error(`refusing ${JSON.stringify(name)} as an identifier`);
  return `"${name}"`;
};

/**
 * An insert that yields to whatever is already there.
 *
 * Re-running the seed has to be a no-op, and `ON CONFLICT DO NOTHING` says exactly that: a row
 * already carrying this primary key wins, including one a developer has since edited by hand. The
 * seed plants a starting point, it does not reassert it.
 *
 * @param {string} table table name.
 * @param {object[]} rows rows to insert; the first row's keys fix the column list.
 * @returns {string} one INSERT statement, or an empty string when there are no rows.
 */
export const insertIgnore = (table, rows) => {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length !== columns.length || keys.some((k, i) => k !== columns[i]))
      throw new Error(
        `every ${table} row must carry the same columns in the same order: ${keys.join()} vs ${columns.join()}`,
      );
  }
  const values = rows
    .map((row) => `(${columns.map((c) => literal(row[c])).join(', ')})`)
    .join(',\n  ');
  return [
    `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(', ')})`,
    `VALUES\n  ${values}`,
    'ON CONFLICT DO NOTHING;',
  ].join('\n');
};
