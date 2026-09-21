import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  applyEdit,
  classify,
  renderTable,
  summarise,
  validateSpec,
} from './mutants-core.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..', '..');

const read = (absolute) => fs.readFileSync(absolute, 'utf8');

/**
 * Run the spec's command and answer only whether it accepted what it was given.
 *
 * Output is swallowed on purpose. A mutant run is expected to fail most of the time, and printing
 * a failing suite for each one buries the table that is the actual result.
 */
export const runCommand = async (command, cwd) => {
  try {
    await exec(command, { cwd, shell: true, maxBuffer: 64 * 1024 * 1024 });
    return 0;
  } catch (error) {
    return typeof error.code === 'number' ? error.code : 1;
  }
};

/**
 * Put every target file back, reporting what it could not put back rather than throwing.
 *
 * Restoration cannot raise: it runs after the mutant's own result exists, and an exception here
 * would discard that result and, worse, swallow a harness error the run had already found. The
 * caller raises once the tree is as close to clean as it can be got.
 */
const restore = (before) => {
  const unrestored = [];
  for (const [absolute, original] of before) {
    try {
      fs.writeFileSync(absolute, original);
      if (read(absolute) !== original) unrestored.push(absolute);
    } catch {
      unrestored.push(absolute);
    }
  }
  return unrestored;
};

/**
 * One mutant, with the three checks that make its result mean anything.
 *
 * The file is asserted to have changed before the command runs, asserted to still be mutated after
 * it, and asserted byte-identical to the original once it is put back. Without the first, a mutant
 * that never landed reports exactly what a gate that missed it reports. Without the second, a
 * generator or formatter can undo the mutant mid-run and the command judges code nobody wrote.
 * Without the third, every later mutant runs against a tree an earlier one left behind.
 */
export const runMutant = async (mutant, { command, cwd }) => {
  const targets = mutant.edits.map((edit) => path.resolve(cwd, edit.file));
  const before = new Map(targets.map((absolute) => [absolute, read(absolute)]));

  let result;
  try {
    for (const edit of mutant.edits) {
      const absolute = path.resolve(cwd, edit.file);
      fs.writeFileSync(absolute, applyEdit(read(absolute), edit).text);
    }

    const mutated = new Map(
      targets.map((absolute) => [absolute, read(absolute)]),
    );
    for (const absolute of targets)
      if (mutated.get(absolute) === before.get(absolute))
        throw new Error(
          `${path.relative(ROOT, absolute)} is unchanged after the edit — the mutant never landed, so whatever the command says is not a result about the gate`,
        );

    const outcome = classify(await runCommand(command, cwd));

    for (const absolute of targets)
      if (read(absolute) !== mutated.get(absolute))
        throw new Error(
          `${path.relative(ROOT, absolute)} changed while the command ran — a generator or formatter undid the mutant, so the command judged code nobody wrote`,
        );

    result = { name: mutant.name, expect: mutant.expect, actual: outcome };
  } catch (error) {
    result = {
      name: mutant.name,
      expect: mutant.expect,
      actual: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const unrestored = restore(before);
  if (unrestored.length > 0)
    throw new Error(
      `could not restore ${unrestored.map((absolute) => path.relative(ROOT, absolute)).join(', ')} — STOP and check those files before doing anything else`,
    );

  return result;
};

/**
 * Run a mutant again before letting it disagree with its author.
 *
 * A mutant that behaves as expected is believed the first time; one that does not is asked twice,
 * because the two explanations for a surprise are not equally likely to be stable. A gate that
 * genuinely misses a mutant misses it every time, so a real disagreement survives the second run
 * and is reported. An unstable one does not, and reporting a coin flip as a verdict is how this
 * harness would end up making the kind of claim it exists to check.
 */
export const confirm = async (mutant, context) => {
  const first = await runMutant(mutant, context);
  if (first.error !== undefined || first.actual === mutant.expect) return first;

  const second = await runMutant(mutant, context);
  if (second.error !== undefined) return second;
  if (second.actual === first.actual) return first;

  return {
    name: mutant.name,
    expect: mutant.expect,
    actual: undefined,
    error: `unstable — two identical runs disagreed (${first.actual}, then ${second.actual}); this mutant proves nothing until that is explained`,
  };
};

const main = async () => {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error(
      'usage: node tools/mutants/run-mutants.mjs <spec.mutants.mjs>',
    );
    process.exit(2);
  }

  const absoluteSpec = path.resolve(ROOT, specPath);
  const spec = (await import(pathToFileURL(absoluteSpec).href)).default;

  const problems = validateSpec(spec);
  if (problems.length > 0) {
    console.error(
      `${specPath} is not a usable spec:\n  ${problems.join('\n  ')}`,
    );
    process.exit(2);
  }

  const cwd = path.resolve(ROOT, spec.cwd ?? '.');
  console.log(
    `${spec.mutants.length} mutants · ${spec.command} · ${path.relative(ROOT, cwd) || '.'}\n`,
  );

  if (classify(await runCommand(spec.command, cwd)) === 'fail') {
    console.error(
      'the command already fails before any mutant is applied, so every result below would be meaningless — fix the baseline first',
    );
    process.exit(2);
  }

  const results = [];
  for (const mutant of spec.mutants) {
    const result = await confirm(mutant, { command: spec.command, cwd });
    results.push(result);
    const mark = result.error
      ? '!'
      : result.actual === result.expect
        ? '.'
        : 'X';
    console.log(
      `  ${mark} ${result.name}${result.error ? `\n      ${result.error}` : ''}`,
    );
  }

  if (classify(await runCommand(spec.command, cwd)) === 'fail') {
    console.error(
      '\nthe command fails now that every mutant has been restored — the tree is not back where it started',
    );
    process.exit(2);
  }

  const tally = summarise(results);
  console.log(`\n${renderTable(results)}\n`);
  console.log(
    `${tally.agreed}/${tally.total} agreed · ${tally.disagreed} disagreed · ${tally.harnessErrors} harness errors · baseline verified before and after`,
  );
  process.exit(tally.disagreed + tally.harnessErrors === 0 ? 0 : 1);
};

if (process.argv[1] === import.meta.filename) await main();
