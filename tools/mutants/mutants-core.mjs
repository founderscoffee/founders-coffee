export const OUTCOMES = ['pass', 'fail'];

/**
 * Apply one literal edit, refusing anything the author cannot have meant.
 *
 * A `find` that matches nothing, or matches several places when the author wrote one, is a mistake
 * in the spec rather than a result about the gate — and both fail silently if the runner just calls
 * `replace`. `String.replace` with a string argument substitutes the first match and says nothing
 * about the others, which is how a mutant ends up landing somewhere its author never looked.
 */
export const applyEdit = (source, edit) => {
  const { find, replace, all = false } = edit;
  if (typeof find !== 'string' || find === '')
    throw new Error('an edit needs a non-empty `find`');
  if (typeof replace !== 'string')
    throw new Error(
      `\`replace\` must be a string, for find ${JSON.stringify(find.slice(0, 40))}`,
    );

  const occurrences = source.split(find).length - 1;
  if (occurrences === 0)
    throw new Error(`nothing matched ${JSON.stringify(find.slice(0, 80))}`);
  if (occurrences > 1 && !all)
    throw new Error(
      `${occurrences} places match ${JSON.stringify(find.slice(0, 80))} — narrow it, or set \`all: true\` if sweeping every one is the point`,
    );

  return {
    text: all
      ? source.split(find).join(replace)
      : source.replace(find, replace),
    occurrences,
  };
};

/**
 * Read a spec the way the runner will, and say what is wrong before anything is written to disk.
 *
 * Validation happens up front rather than per mutant because the runner mutates real files: a spec
 * that is malformed at its fourth mutant would otherwise be discovered with three files already
 * edited, and a crash there leaves the tree changed.
 */
export const validateSpec = (spec) => {
  const problems = [];
  if (!spec || typeof spec !== 'object') return ['the spec exported nothing'];
  if (typeof spec.command !== 'string' || spec.command.trim() === '')
    problems.push('`command` must be a non-empty string');
  if (!Array.isArray(spec.mutants) || spec.mutants.length === 0)
    problems.push('`mutants` must be a non-empty array');

  for (const [index, mutant] of (spec.mutants ?? []).entries()) {
    const at = `mutant ${index + 1}${mutant?.name ? ` (${mutant.name})` : ''}`;
    if (!mutant?.name) problems.push(`${at}: needs a \`name\``);
    if (!OUTCOMES.includes(mutant?.expect))
      problems.push(
        `${at}: \`expect\` must be 'pass' or 'fail', not ${JSON.stringify(mutant?.expect)}`,
      );
    if (!Array.isArray(mutant?.edits) || mutant.edits.length === 0)
      problems.push(`${at}: needs at least one edit`);
    for (const edit of mutant?.edits ?? [])
      if (typeof edit?.file !== 'string' || edit.file === '')
        problems.push(`${at}: an edit needs a \`file\``);
  }
  return problems;
};

/** Exit zero means the gate accepted the mutant; anything else means it rejected it. */
export const classify = (exitCode) => (exitCode === 0 ? 'pass' : 'fail');

/**
 * The table the commit message quotes, with the harness's own failures kept separate.
 *
 * A mutant that never reached the file is not a result about the gate, so it is never rendered as
 * one. That conflation is the whole reason this tool exists.
 */
export const renderTable = (results) => {
  const rows = results.map((result) => {
    const mark =
      result.error !== undefined
        ? 'HARNESS ERROR'
        : result.actual === result.expect
          ? result.actual
          : `${result.actual} — EXPECTED ${result.expect}`;
    return `| ${result.name} | ${result.expect} | ${mark} |`;
  });
  return ['| mutant | expected | got |', '| --- | --- | --- |', ...rows].join(
    '\n',
  );
};

export const summarise = (results) => ({
  total: results.length,
  agreed: results.filter((r) => r.error === undefined && r.actual === r.expect)
    .length,
  disagreed: results.filter(
    (r) => r.error === undefined && r.actual !== r.expect,
  ).length,
  harnessErrors: results.filter((r) => r.error !== undefined).length,
});
