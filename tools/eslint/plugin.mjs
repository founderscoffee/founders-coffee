import { commentPolicy } from './rules/comment-policy.mjs';
import { noBareStatusRole } from './rules/no-bare-status-role.mjs';
import { noComments } from './rules/no-comments.mjs';
import { noLineComments } from './rules/no-line-comments.mjs';
import { noServerFnsInComponents } from './rules/no-server-fns-in-components.mjs';
import { sectionCitation } from './rules/section-citation.mjs';

export const localPlugin = {
  meta: { name: 'founders-coffee-local', version: '1.0.0' },
  rules: {
    'comment-policy': commentPolicy,
    'no-bare-status-role': noBareStatusRole,
    'no-comments': noComments,
    'no-line-comments': noLineComments,
    'no-server-fns-in-components': noServerFnsInComponents,
    'section-citation': sectionCitation,
  },
};
