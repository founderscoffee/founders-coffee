import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  applyEdit,
  classify,
  renderTable,
  summarise,
  validateSpec,
} from './mutants-core.mjs';
import { runMutant } from './run-mutants.mjs';

describe('applyEdit', () => {
  it('replaces the one place the author meant', () => {
    expect(applyEdit('a b c', { find: 'b', replace: 'B' })).toEqual({
      text: 'a B c',
      occurrences: 1,
    });
  });

  it('refuses a find that matches nothing, rather than reporting a mutant that never landed', () => {
    expect(() => applyEdit('a b c', { find: 'z', replace: 'Z' })).toThrow(
      /nothing matched/u,
    );
  });

  it('refuses an ambiguous find, because replace would silently take the first', () => {
    expect(() => applyEdit('a a a', { find: 'a', replace: 'A' })).toThrow(
      /3 places match/u,
    );
  });

  it('sweeps every occurrence when that is stated to be the point', () => {
    expect(
      applyEdit('a a a', { find: 'a', replace: 'A', all: true }).text,
    ).toBe('A A A');
  });
});

describe('validateSpec', () => {
  const good = {
    command: 'true',
    mutants: [
      {
        name: 'x',
        expect: 'fail',
        edits: [{ file: 'f', find: 'a', replace: 'b' }],
      },
    ],
  };

  it('passes a usable spec', () => {
    expect(validateSpec(good)).toEqual([]);
  });

  it('names every problem at once, before anything is written to disk', () => {
    const problems = validateSpec({
      command: '',
      mutants: [{ name: '', expect: 'maybe', edits: [] }],
    });
    expect(problems.length).toBeGreaterThanOrEqual(4);
    expect(problems.join(' ')).toMatch(/command/u);
    expect(problems.join(' ')).toMatch(/'pass' or 'fail'/u);
  });
});

describe('reporting', () => {
  it('keeps a harness error out of the results column', () => {
    const results = [
      { name: 'a', expect: 'fail', actual: 'fail' },
      { name: 'b', expect: 'fail', actual: 'pass' },
      { name: 'c', expect: 'fail', actual: undefined, error: 'never landed' },
    ];
    expect(renderTable(results)).toContain('| c | fail | HARNESS ERROR |');
    expect(renderTable(results)).toContain(
      '| b | fail | pass — EXPECTED fail |',
    );
    expect(summarise(results)).toEqual({
      total: 3,
      agreed: 1,
      disagreed: 1,
      harnessErrors: 1,
    });
  });

  it('reads a zero exit as the gate accepting the mutant', () => {
    expect(classify(0)).toBe('pass');
    expect(classify(1)).toBe('fail');
  });
});

const temporary = [];

const scratch = (contents) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mutants-'));
  temporary.push(directory);
  fs.writeFileSync(path.join(directory, 'target.txt'), contents);
  return directory;
};

afterEach(() => {
  for (const directory of temporary.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

describe('runMutant', () => {
  it('puts the file back even when the command fails', async () => {
    const cwd = scratch('original');
    const result = await runMutant(
      {
        name: 'x',
        expect: 'fail',
        edits: [{ file: 'target.txt', find: 'original', replace: 'mutated' }],
      },
      { command: 'exit 1', cwd },
    );

    expect(result.actual).toBe('fail');
    expect(fs.readFileSync(path.join(cwd, 'target.txt'), 'utf8')).toBe(
      'original',
    );
  });

  it('calls an edit that changes nothing a harness error, not a result', async () => {
    const cwd = scratch('original');
    const result = await runMutant(
      {
        name: 'x',
        expect: 'fail',
        edits: [{ file: 'target.txt', find: 'original', replace: 'original' }],
      },
      { command: 'exit 1', cwd },
    );

    expect(result.actual).toBeUndefined();
    expect(result.error).toMatch(/unchanged after the edit/u);
  });

  it('notices a command that undoes the mutant while it runs', async () => {
    const cwd = scratch('original');
    const result = await runMutant(
      {
        name: 'x',
        expect: 'fail',
        edits: [{ file: 'target.txt', find: 'original', replace: 'mutated' }],
      },
      { command: 'printf original > target.txt && exit 1', cwd },
    );

    expect(result.actual).toBeUndefined();
    expect(result.error).toMatch(/changed while the command ran/u);
  });
});
