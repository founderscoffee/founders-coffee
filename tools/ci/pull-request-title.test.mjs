import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { COMMIT_TYPES, parseCommit, renderNotes } from '../release/version.mjs';
import { titleProblem } from './pull-request-title.mjs';

const SCRIPT = path.join(import.meta.dirname, 'pull-request-title.mjs');

const runWithTitle = (title) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      env: { ...process.env, PULL_REQUEST_TITLE: title },
      encoding: 'utf8',
    });
    return { status: 0, stdout };
  } catch (error) {
    return { status: error.status, stdout: String(error.stdout) };
  }
};

describe('a pull request title', () => {
  it.each([
    'fix(events): count a cancelled RSVP once',
    'feat(i18n): add the French wording for the waitlist notice',
    'docs: explain the local setup',
    'feat(auth)!: drop the bearer plugin',
    '  chore(deps): bump vitest  ',
  ])('is accepted as a commit subject: %s', (title) => {
    expect(titleProblem(title)).toBeNull();
  });

  it.each([
    ['Update README', 'is not a Conventional Commit header'],
    ['fixed the RSVP count', 'is not a Conventional Commit header'],
    [
      'Fix(events): count a cancelled RSVP once',
      'is not a Conventional Commit',
    ],
    ['wip: rsvp', 'starts with "wip"'],
    ['release: everything on develop', 'starts with "release"'],
    ['fix(events):    ', 'is not a Conventional Commit header'],
    ['', 'is not a Conventional Commit header'],
  ])('is refused: %j', (title, reason) => {
    expect(titleProblem(title)).toContain(reason);
  });

  it('names every type the release notes group by when it refuses one', () => {
    expect(titleProblem('wip: rsvp')).toContain(COMMIT_TYPES.join(', '));
  });

  it('never lets an accepted title reach the release notes as "Other"', () => {
    const title = 'perf(events): read a meetup in one trip';
    const notes = renderNotes({
      version: '0.20.0',
      previousTag: 'v0.19.0',
      commits: [{ ...parseCommit({ sha: 'a'.repeat(40), subject: title }) }],
    });

    expect(titleProblem(title)).toBeNull();
    expect(notes).toContain('## Performance');
    expect(notes).not.toContain('## Other');
  });
});

describe('the title check run by CI', () => {
  it('passes a Conventional Commit title', () => {
    const result = runWithTitle('fix(events): count a cancelled RSVP once');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice::');
  });

  it('fails any other title with an annotation that says why', () => {
    const result = runWithTitle('Update README');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Pull request title::');
    expect(result.stdout).toContain('CONTRIBUTING.md');
  });
});
