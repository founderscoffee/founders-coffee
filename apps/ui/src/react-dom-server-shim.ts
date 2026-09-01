import {
  renderToString,
  renderToStaticMarkup,
  renderToReadableStream,
} from 'react-dom/server.browser';

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
