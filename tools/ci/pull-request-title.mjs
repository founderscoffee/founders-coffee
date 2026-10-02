import { pathToFileURL } from 'node:url';

import { COMMIT_TYPES, parseCommit } from '../release/version.mjs';

const EXAMPLE = 'fix(events): count a cancelled RSVP once';

/**
 * Why a pull request's title cannot be the subject of the commit it is squashed into, or `null`
 * when it can.
 *
 * A contributor's pull request is squash-merged into `develop` with its title as the commit's
 * subject, and `version.mjs` reads the release version and notes from those subjects. A title is
 * accepted only when that same parser reads it as one of the types the notes are grouped by, so a
 * change cannot bump the version the wrong way, or reach the notes as "Other", because of how its
 * pull request was named.
 *
 * @param {string} title the pull request's title.
 * @returns {string | null} the reason, worded to follow "the title", or `null`.
 */
export const titleProblem = (title) => {
  const { type } = parseCommit({
    sha: '',
    subject: title.trim(),
    body: '',
  });
  if (type === null)
    return `is not a Conventional Commit header, such as "${EXAMPLE}"`;
  if (!COMMIT_TYPES.includes(type))
    return `starts with "${type}", which is not one of ${COMMIT_TYPES.join(', ')}`;
  return null;
};

const main = () => {
  const problem = titleProblem(process.env.PULL_REQUEST_TITLE ?? '');
  if (problem === null) {
    process.stdout.write('::notice::The title is a Conventional Commit.\n');
    return;
  }
  process.stdout.write(
    `::error title=Pull request title::The title becomes the commit subject on develop, and it ${problem}. See CONTRIBUTING.md.\n`,
  );
  process.exitCode = 1;
};

const isCli =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCli) main();
