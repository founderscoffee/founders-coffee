import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { linkLocalState } from './link-state.mjs';

let root;

const app = (name, { withConfig = true } = {}) => {
  const dir = path.join(root, 'apps', name);
  fs.mkdirSync(dir, { recursive: true });
  if (withConfig) fs.writeFileSync(path.join(dir, 'wrangler.jsonc'), '{}');
  return dir;
};

const statePath = (name) => path.join(root, 'apps', name, '.wrangler', 'state');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-state-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('linkLocalState', () => {
  it('links every app that has a Wrangler configuration, and no others', () => {
    app('ui');
    app('worker-jobs');
    app('docs-site', { withConfig: false });

    const result = linkLocalState(root);

    expect(result.linked).toEqual(['ui', 'worker-jobs']);
    expect(fs.realpathSync(statePath('ui'))).toBe(
      fs.realpathSync(path.join(root, '.wrangler', 'state')),
    );
    expect(fs.existsSync(statePath('docs-site'))).toBe(false);
  });

  it('is safe to run repeatedly', () => {
    app('ui');
    linkLocalState(root);

    const second = linkLocalState(root);

    expect(second).toMatchObject({ linked: [], alreadyLinked: ['ui'] });
  });

  it('replaces an empty state directory left by a bare command', () => {
    app('ui');
    fs.mkdirSync(statePath('ui'), { recursive: true });

    expect(linkLocalState(root).linked).toEqual(['ui']);
    expect(fs.lstatSync(statePath('ui')).isSymbolicLink()).toBe(true);
  });

  it('never deletes a state directory that holds a database', () => {
    app('ui');
    fs.mkdirSync(path.join(statePath('ui'), 'v3', 'd1'), { recursive: true });
    const stray = path.join(statePath('ui'), 'v3', 'd1', 'db.sqlite');
    fs.writeFileSync(stray, 'not really sqlite');

    const result = linkLocalState(root);

    expect(result).toMatchObject({ linked: [], blocked: ['ui'] });
    expect(fs.readFileSync(stray, 'utf8')).toBe('not really sqlite');
  });

  it('repairs a link that points somewhere else', () => {
    app('ui');
    fs.mkdirSync(path.dirname(statePath('ui')), { recursive: true });
    fs.symlinkSync('/tmp/somewhere-else', statePath('ui'));

    expect(linkLocalState(root).linked).toEqual(['ui']);
    expect(fs.realpathSync(statePath('ui'))).toBe(
      fs.realpathSync(path.join(root, '.wrangler', 'state')),
    );
  });
});
