import fs from 'node:fs';
import path from 'node:path';

const SHARED_STATE = path.join('.wrangler', 'state');

/**
 * Point every app's local Cloudflare state at the one shared directory.
 *
 * Wrangler resolves `.wrangler/state` relative to the Wrangler configuration file when
 * `--persist-to` is absent, so a bare `wrangler d1 execute --local` run inside an app creates a
 * second, empty database there and reports success against it. Configuration cannot prevent that:
 * there is no persist key and no environment variable, only the flag. A symlink can, because the
 * default path then resolves onto the shared state whether or not anyone remembers the flag.
 *
 * A real directory holding data is never replaced. If one exists, it is reported and left alone —
 * deleting it would destroy whatever database somebody had been using, which is the opposite of
 * what this is for.
 *
 * @param {string} repoRoot absolute path to the repository root.
 * @returns {{ linked: string[], alreadyLinked: string[], blocked: string[] }} what happened, per app.
 */
export const linkLocalState = (repoRoot) => {
  const appsDir = path.join(repoRoot, 'apps');
  const result = { linked: [], alreadyLinked: [], blocked: [] };
  if (!fs.existsSync(appsDir)) return result;

  for (const app of fs.readdirSync(appsDir).sort()) {
    const appDir = path.join(appsDir, app);
    if (!fs.existsSync(path.join(appDir, 'wrangler.jsonc'))) continue;

    const linkPath = path.join(appDir, '.wrangler', 'state');
    const target = path.relative(
      path.dirname(linkPath),
      path.join(repoRoot, SHARED_STATE),
    );
    const existing = fs.lstatSync(linkPath, { throwIfNoEntry: false });

    if (existing?.isSymbolicLink()) {
      if (fs.readlinkSync(linkPath) === target) {
        result.alreadyLinked.push(app);
        continue;
      }
      fs.unlinkSync(linkPath);
    } else if (existing?.isDirectory()) {
      if (fs.readdirSync(linkPath).length > 0) {
        result.blocked.push(app);
        continue;
      }
      fs.rmdirSync(linkPath);
    }

    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, SHARED_STATE), { recursive: true });
    fs.symlinkSync(target, linkPath);
    result.linked.push(app);
  }
  return result;
};

const isCli =
  process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isCli) {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const { linked, blocked } = linkLocalState(root);
  if (linked.length > 0) {
    console.log(`local Cloudflare state shared for: ${linked.join(', ')}`);
  }
  for (const app of blocked) {
    console.warn(
      `apps/${app}/.wrangler/state holds its own data and was left alone. ` +
        `Move anything you need into .wrangler/state, delete it, then re-run this.`,
    );
  }
}
