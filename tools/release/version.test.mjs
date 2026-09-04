import { describe, expect, it } from 'vitest';

import {
  latestReleaseTag,
  nextVersion,
  parseCommit,
  renderNotes,
} from './version.mjs';

const commit = (subject, body = '') =>
  parseCommit({ sha: 'abcdef1234567890', subject, body });

describe('latestReleaseTag', () => {
  it('takes the first release tag and ignores anything that is not one', () => {
    expect(latestReleaseTag(['nightly-3', 'v1.2', 'v0.4.0', 'v0.3.0'])).toBe(
      'v0.4.0',
    );
  });

  it('reports no baseline rather than inventing one', () => {
    expect(latestReleaseTag([])).toBeNull();
    expect(latestReleaseTag(['nightly-3', 'v1.2'])).toBeNull();
  });
});

describe('parseCommit', () => {
  it('splits type, scope and subject', () => {
    expect(commit('feat(events): add the wizard')).toMatchObject({
      type: 'feat',
      scope: 'events',
      subject: 'add the wizard',
      breaking: false,
    });
  });

  it('accepts a scopeless subject', () => {
    expect(commit('chore: bump the runtime')).toMatchObject({
      type: 'chore',
      scope: null,
      subject: 'bump the runtime',
    });
  });

  it('reads a breaking marker from the header and from the footer', () => {
    expect(commit('feat(events)!: drop the challenge').breaking).toBe(true);
    expect(
      commit('fix(auth): rotate the secret', 'BREAKING CHANGE: tokens reset')
        .breaking,
    ).toBe(true);
    expect(
      commit('fix(auth): rotate the secret', 'BREAKING-CHANGE: tokens reset')
        .breaking,
    ).toBe(true);
  });

  it('keeps a non-conventional subject instead of discarding the commit', () => {
    expect(commit('Initial commit')).toMatchObject({
      type: null,
      scope: null,
      subject: 'Initial commit',
    });
  });
});

describe('nextVersion', () => {
  it('seeds the first release at 0.1.0', () => {
    expect(nextVersion(null, [commit('feat: anything')])).toBe('0.1.0');
  });

  it('treats a breaking change before 1.0 as a minor bump, not a major one', () => {
    expect(nextVersion('v0.4.2', [commit('feat(events)!: drop it')])).toBe(
      '0.5.0',
    );
  });

  it('bumps minor for a feature and patch for everything else while pre-1.0', () => {
    expect(nextVersion('v0.4.2', [commit('feat(ui): add a page')])).toBe(
      '0.5.0',
    );
    expect(nextVersion('v0.4.2', [commit('fix(ui): correct a label')])).toBe(
      '0.4.3',
    );
    expect(nextVersion('v0.4.2', [commit('docs: record evidence')])).toBe(
      '0.4.3',
    );
  });

  it('applies ordinary semver once the major is at least 1', () => {
    expect(nextVersion('v1.4.2', [commit('feat(events)!: drop it')])).toBe(
      '2.0.0',
    );
    expect(nextVersion('v1.4.2', [commit('feat(ui): add a page')])).toBe(
      '1.5.0',
    );
    expect(nextVersion('v1.4.2', [commit('chore: tidy')])).toBe('1.4.3');
  });

  it('takes the highest bump any commit in the range asks for', () => {
    expect(
      nextVersion('v1.4.2', [
        commit('docs: record evidence'),
        commit('feat(ui): add a page'),
      ]),
    ).toBe('1.5.0');
  });
});

describe('renderNotes', () => {
  const notes = (previousTag, commits, repoUrl) =>
    renderNotes({ version: '0.5.0', previousTag, commits, repoUrl });

  it('leads with breaking changes and lists each type once', () => {
    const body = notes('v0.4.2', [
      commit('feat(events)!: drop the challenge'),
      commit('feat(ui): add a page'),
      commit('fix(ui): correct a label'),
    ]);
    expect(body.indexOf('Breaking changes')).toBeLessThan(
      body.indexOf('## Features'),
    );
    expect(body).toContain('- **events:** drop the challenge (`abcdef1`)');
    expect(body).toContain('- **ui:** add a page (`abcdef1`)');
    expect(body.match(/drop the challenge/g)).toHaveLength(1);
  });

  it('lists a non-conventional commit under Other rather than dropping it', () => {
    expect(notes('v0.4.2', [commit('Initial commit')])).toContain(
      '## Other\n\n- Initial commit',
    );
  });

  it('describes the first release without a comparison it cannot make', () => {
    const body = notes(
      null,
      [commit('feat: anything')],
      'https://example.test',
    );
    expect(body).toContain('First tagged release — 1 commits.');
    expect(body).not.toContain('Full changelog');
  });

  it('links the comparison range when there is a previous tag', () => {
    expect(
      notes('v0.4.2', [commit('feat: anything')], 'https://example.test'),
    ).toContain('https://example.test/compare/v0.4.2...v0.5.0');
  });
});
