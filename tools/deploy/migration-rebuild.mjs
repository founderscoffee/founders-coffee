import fs from 'node:fs';
import path from 'node:path';

const irreversiblePatterns = [
  /\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/iu,
  /\bDELETE\s+FROM\b/iu,
  /\bALTER\s+TABLE\b[^;]*\bRENAME\b/iu,
];
const statementSeparator = '--> statement-breakpoint';
const lineCommentPattern = /--(?!>).*$/gmu;
const rebuildCreatePattern = /^CREATE\s+TABLE\s+`?__new_([A-Za-z0-9_]+)`?/iu;
const rebuildCopyPattern =
  /^INSERT\s+INTO\s+`?__new_([A-Za-z0-9_]+)`?[\s\S]*\bFROM\s+`?\1`?/iu;
const rebuildDropPattern = /^DROP\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*;?$/iu;
const rebuildRenamePattern =
  /^ALTER\s+TABLE\s+`?__new_([A-Za-z0-9_]+)`?\s+RENAME\s+TO\s+`?\1`?/iu;
const rebuildSteps = ['created', 'copied', 'dropped', 'renamed'];

export const findIrreversibleStatements = (sql) =>
  irreversiblePatterns
    .filter((pattern) => pattern.test(sql))
    .map((pattern) => pattern.source);

const parseStatements = (sql) =>
  sql
    .split(statementSeparator)
    .map((statement) => statement.replace(lineCommentPattern, '').trim())
    .filter((statement) => statement.length > 0);

/*
 * SQLite cannot change a column default in place, so Drizzle rebuilds the table:
 * create `__new_X`, copy every row into it, drop `X`, rename `__new_X` to `X`. The
 * DROP and the RENAME are how that ALTER is spelled rather than a loss of anything,
 * so all four steps must be present before the pair is read that way - a rebuild
 * missing its copy would leave the rows behind, and stays irreversible.
 */
export const parseTableRebuilds = (sql) => {
  const steps = new Map();
  const record = (table, step) =>
    steps.set(table, (steps.get(table) ?? new Set()).add(step));
  for (const statement of parseStatements(sql)) {
    const created = rebuildCreatePattern.exec(statement);
    if (created) record(created[1], 'created');
    const copied = rebuildCopyPattern.exec(statement);
    if (copied) record(copied[1], 'copied');
    const renamed = rebuildRenamePattern.exec(statement);
    if (renamed) record(renamed[1], 'renamed');
    const dropped = rebuildDropPattern.exec(statement);
    if (dropped) record(dropped[1], 'dropped');
  }
  return [...steps]
    .filter(([, seen]) => rebuildSteps.every((step) => seen.has(step)))
    .map(([table]) => table);
};

const snapshotFile = (migrationsDirectory, index) =>
  path.join(
    migrationsDirectory,
    'meta',
    `${String(index).padStart(4, '0')}_snapshot.json`,
  );

/*
 * Drizzle writes one schema snapshot per generated migration, so the pair around a
 * migration is what the rebuild did. A hand-written migration has no snapshot, and
 * without both sides there is nothing to compare: that is read as unverified rather
 * than as proof of anything.
 */
const loadSchemaChange = ({ migration, migrationsDirectory }) => {
  const journalFile = path.join(migrationsDirectory, 'meta', '_journal.json');
  if (!fs.existsSync(journalFile)) return undefined;
  const { entries } = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
  const position = entries.findIndex((entry) => entry.tag === migration);
  if (position < 1) return undefined;
  const files = [entries[position - 1], entries[position]].map((entry) =>
    snapshotFile(migrationsDirectory, entry.idx),
  );
  if (!files.every((file) => fs.existsSync(file))) return undefined;
  const [before, after] = files.map((file) =>
    JSON.parse(fs.readFileSync(file, 'utf8')),
  );
  return { before, after };
};

/*
 * What a Worker rolled back across the migration still needs: every column it knew is
 * still there, and none of them started refusing the writes it makes without a default
 * to fall back on. A rebuild that adds or re-defaults columns leaves both true.
 */
const preservesColumns = ({ before, after, table }) => {
  const previous = before.tables?.[table]?.columns;
  const current = after.tables?.[table]?.columns;
  if (!previous || !current) return false;
  return Object.values(previous).every((column) => {
    const kept = current[column.name];
    if (!kept) return false;
    return !kept.notNull || column.notNull || Object.hasOwn(kept, 'default');
  });
};

export const findIncompatibleStatements = ({
  sql,
  migration,
  migrationsDirectory,
}) => {
  const change = loadSchemaChange({ migration, migrationsDirectory });
  const preserved = new Set(
    change
      ? parseTableRebuilds(sql).filter((table) =>
          preservesColumns({ ...change, table }),
        )
      : [],
  );
  const explained = (statement) => {
    const dropped = rebuildDropPattern.exec(statement);
    if (dropped && preserved.has(dropped[1])) return true;
    const renamed = rebuildRenamePattern.exec(statement);
    return Boolean(renamed && preserved.has(renamed[1]));
  };
  return parseStatements(sql).filter(
    (statement) =>
      findIrreversibleStatements(statement).length > 0 && !explained(statement),
  );
};
