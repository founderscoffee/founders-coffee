/**
 * Conventional-commit release rules for this repository.
 *
 * Pure functions only: everything here takes git output as data and returns data, so the release
 * decision can be tested without a repository and previewed without a deployment. Reading git and
 * writing files is `next-release.mjs`.
 */

export const SEED_VERSION = '0.1.0';

const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

const HEADER =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<subject>.+)$/;

const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;

const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['chore', 'Chores'],
  ['style', 'Style'],
];

/**
 * The newest release tag, by semantic version rather than by creation date.
 *
 * `git tag --sort=-v:refname` already orders numerically, so this only has to reject tags that are
 * not releases — a `v1.2` or a `nightly-*` must never become the baseline a version is bumped from.
 */
export const latestReleaseTag = (tags) =>
  tags.find((tag) => RELEASE_TAG.test(tag)) ?? null;

export const parseCommit = ({ sha, subject, body }) => {
  const match = HEADER.exec(subject);
  const breaking =
    Boolean(match?.groups?.breaking) || BREAKING_FOOTER.test(body ?? '');
  if (!match) {
    return { sha, type: null, scope: null, subject, breaking };
  }
  const { type, scope, subject: text } = match.groups;
  return { sha, type, scope: scope || null, subject: text, breaking };
};

/**
 * The next version, under the pre-1.0 rule that a breaking change is a minor bump.
 *
 * While the major is `0` the public contract is explicitly unstable, so promoting a breaking change
 * to `1.0.0` would claim a stability this release does not have. Once the major reaches `1`, the
 * ordinary semver rules apply.
 */
export const nextVersion = (previousTag, commits) => {
  if (previousTag === null) return SEED_VERSION;
  const [, major, minor, patch] = RELEASE_TAG.exec(previousTag).map(Number);
  const breaking = commits.some((commit) => commit.breaking);
  const feature = commits.some((commit) => commit.type === 'feat');
  if (major === 0) {
    return breaking || feature ? `0.${minor + 1}.0` : `0.${minor}.${patch + 1}`;
  }
  if (breaking) return `${major + 1}.0.0`;
  if (feature) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const entry = (commit) => {
  const scope = commit.scope === null ? '' : `**${commit.scope}:** `;
  return `- ${scope}${commit.subject} (\`${commit.sha.slice(0, 7)}\`)`;
};

const section = (title, commits) =>
  commits.length === 0 ? [] : [`## ${title}`, '', ...commits.map(entry), ''];

/**
 * Release notes grouped by conventional-commit type, breaking changes first.
 *
 * Commits whose subject is not conventional are listed under "Other" rather than dropped: a release
 * note that silently omits a change is worse than an untidy one.
 */
export const renderNotes = ({ version, previousTag, commits, repoUrl }) => {
  const known = new Set(SECTIONS.map(([type]) => type));
  const lines = [
    previousTag === null
      ? `First tagged release — ${commits.length} commits.`
      : `${commits.length} commits since ${previousTag}.`,
    '',
    ...section(
      '⚠️ Breaking changes',
      commits.filter((commit) => commit.breaking),
    ),
  ];
  for (const [type, title] of SECTIONS) {
    lines.push(
      ...section(
        title,
        commits.filter((commit) => commit.type === type && !commit.breaking),
      ),
    );
  }
  lines.push(
    ...section(
      'Other',
      commits.filter(
        (commit) => !known.has(commit.type ?? '') && !commit.breaking,
      ),
    ),
  );
  if (repoUrl !== undefined && previousTag !== null) {
    lines.push(
      `**Full changelog:** ${repoUrl}/compare/${previousTag}...v${version}`,
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
};
