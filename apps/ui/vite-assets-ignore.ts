import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { CLIENT_OUT_DIR } from './vite-service-worker';

const ASSETS_IGNORE = '.assetsignore';

const SOURCE = `public/${ASSETS_IGNORE}`;

/**
 * What the asset bucket must refuse to publish, asserted against the file that does the refusing.
 *
 * Workers Assets uploads whatever sits in the client output, and Vite copies `public/` into it
 * verbatim — `.DS_Store` included, which is ten kilobytes of the build machine's own directory
 * listing, served at `/.DS_Store` to anyone who asks. It shipped that way: nothing in the build
 * said so, because a file being present is not an error.
 *
 * The Cloudflare plugin writes `.assetsignore` with `wrangler.json` and `.dev.vars`, and prepends
 * whatever {@link SOURCE} holds. That merge is the only thing keeping `.DS_Store` out, and it is
 * silent in both directions: delete the source file and the build stays green, keep it and nothing
 * confirms the entry survived. Two concatenated strings are also one missing trailing newline away
 * from producing `.DS_Storewrangler.json`, which ignores neither.
 *
 * So the assertion reads the emitted file rather than the source, and checks the entries are there
 * as whole lines. Deploys are run by hand from a macOS workstation — the one environment where
 * `.DS_Store` exists to be published — and every path that ships runs `vite build`.
 */
export const assertAssetsIgnored = (entries: readonly string[]): Plugin => ({
  name: 'assert-assets-ignored',
  enforce: 'post',
  apply: 'build',
  closeBundle: {
    sequential: true,
    order: 'post',
    // eslint-disable-next-line no-restricted-syntax
    handler() {
      if (this.environment?.name !== 'client') return;
      const built = fileURLToPath(
        new URL(`./${CLIENT_OUT_DIR}/${ASSETS_IGNORE}`, import.meta.url),
      );
      if (!existsSync(built))
        throw new Error(
          `${CLIENT_OUT_DIR}/${ASSETS_IGNORE} was not emitted. Every file in the client output ` +
            'would be uploaded and served, including the Worker config and its secrets.',
        );
      const lines = readFileSync(built, 'utf8').split('\n');
      const missing = entries.filter((entry) => !lines.includes(entry));
      if (missing.length > 0)
        throw new Error(
          `${CLIENT_OUT_DIR}/${ASSETS_IGNORE} does not ignore ${missing.join(', ')}. ` +
            `Add the entry to ${SOURCE}; the plugin merges it ahead of its own.`,
        );
    },
  },
});
