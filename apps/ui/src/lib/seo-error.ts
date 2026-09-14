import {
  error_body,
  error_title,
  not_found_body,
  not_found_title,
  type Locale,
} from '@founders-coffee/i18n';

import { NO_INDEX_VALUE } from './indexation';

export type ErrorPageKind = 'error' | 'notFound';

export const errorPageHead = (locale: Locale, kind: ErrorPageKind) => {
  const copy =
    kind === 'notFound'
      ? {
          title: not_found_title({}, { locale }),
          description: not_found_body({}, { locale }),
        }
      : {
          title: error_title({}, { locale }),
          description: error_body({}, { locale }),
        };
  return {
    meta: [
      { title: `${copy.title} - founders.coffee` },
      { name: 'description', content: copy.description },
      { name: 'robots', content: NO_INDEX_VALUE },
    ],
    links: [],
    scripts: [],
  };
};
