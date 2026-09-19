import { NO_INDEX_VALUE } from './indexation';
import { buildPageTitle } from './seo';

export const privatePageHead = (title: string) => ({
  meta: [
    { title: buildPageTitle(title) },
    { name: 'robots', content: NO_INDEX_VALUE },
  ],
});
