import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import {
  latestReleaseTag,
  nextVersion,
  parseCommit,
  renderNotes,
} from './version.mjs';

const RECORD = '\u001e';
const FIELD = '\u001f';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const readCommits = (previousTag) => {
  const range = previousTag === null ? [] : [`${previousTag}..HEAD`];
  const output = git(
    'log',
    '--no-merges',
    '--format=%H%x1f%s%x1f%b%x1e',
    ...range,
  );
  return output
    .split(RECORD)
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [sha, subject, body] = record.split(FIELD);
      return parseCommit({ sha, subject, body });
    });
};

const notesPath = () => {
  const index = process.argv.indexOf('--notes');
  if (index === -1 || process.argv[index + 1] === undefined) {
    throw new Error('Usage: next-release.mjs --notes <path>');
  }
  return process.argv[index + 1];
};

/**
 * Decide the next release and write its notes, emitting `key=value` lines for `$GITHUB_OUTPUT`.
 *
 * An empty `version` means there is nothing to release — the workflow skips tagging rather than
 * publishing a tag identical to the last one. That happens whenever `main` is redeployed without
 * new commits, which a re-run of a failed deployment does.
 */
const main = () => {
  const target = notesPath();
  const tags = git('tag', '--list', 'v*', '--sort=-v:refname')
    .split('\n')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  const previousTag = latestReleaseTag(tags);
  const commits = readCommits(previousTag);

  if (commits.length === 0) {
    process.stdout.write('version=\ncommits=0\n');
    return;
  }

  const version = nextVersion(previousTag, commits);
  const repoUrl =
    process.env.GITHUB_REPOSITORY === undefined
      ? undefined
      : `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}`;

  writeFileSync(
    target,
    renderNotes({ version, previousTag, commits, repoUrl }),
    'utf8',
  );
  process.stdout.write(
    `version=${version}\nprevious=${previousTag ?? ''}\ncommits=${commits.length}\n`,
  );
};

main();
