/**
 * Interop shim for react-dom/server.browser default-import (TanStack Router issue #7412).
 *
 * React 19's `react-dom/server.browser.js` is CommonJS with only named exports (renderToString,
 * renderToStaticMarkup, renderToReadableStream, resume, version) — no default. But
 * `@tanstack/react-router`'s `renderRouterToString` does `import ReactDOMServer from 'react-dom/server'`,
 * which Vite resolves to server.browser.js in the client environment, and the default import
 * becomes undefined → "doesn't provide an export named: 'default'".
 *
 * Vite cannot reliably interop `export *` from a CJS module, so we re-export the named members
 * explicitly (keeps named-import consumers working) and synthesize a default export that carries
 * the whole namespace (satisfies default-import consumers).
 *
 * Wired via `resolve.alias` (environment: 'client') in vite.config.ts.
 */
import {
  renderToString,
  renderToStaticMarkup,
  renderToReadableStream,
} from 'react-dom/server.browser';

/* `resume` and `version` exist at runtime in react-dom/server.browser.js but are missing from
   the @types/react-dom declaration. @ts-expect-error justified per AGENTS §5 (upstream type gap). */
// @ts-expect-error — 'resume' is in the runtime module but absent from @types/react-dom
import { resume } from 'react-dom/server.browser';
// @ts-expect-error — 'version' is in the runtime module but absent from @types/react-dom
import { version } from 'react-dom/server.browser';

type ReactDOMServerLike = {
  renderToString: typeof renderToString;
  renderToStaticMarkup: typeof renderToStaticMarkup;
  renderToReadableStream: typeof renderToReadableStream;
  resume: (input: unknown) => Promise<unknown>;
  version: string;
};

const ReactDOMServer: ReactDOMServerLike = {
  renderToString,
  renderToStaticMarkup,
  renderToReadableStream,
  resume: resume as ReactDOMServerLike['resume'],
  version,
};

export {
  renderToString,
  renderToStaticMarkup,
  renderToReadableStream,
  resume,
  version,
};
export default ReactDOMServer;
