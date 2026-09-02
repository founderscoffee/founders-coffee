/**
 * The module-boundary contract (AGENTS.md §4, implementation-plan §5).
 *
 * Every project is tagged `type:app|lib`, `layer:ui|server|domain|data|shared`, `domain:<name>`.
 * The layer constraints below enforce the one-directional data flow:
 *
 *   Component -> hook -> api -> server-fn -> domain -> db -> D1
 *
 * A violation is a build-breaking lint error, never a warning.
 *
 * The UI applications carry `layer:app-ui`, not `layer:ui`. They genuinely reach the server layer —
 * `features/<domain>/api.ts` and route loaders call server functions, which is the designed path — while
 * `libs/ui` must never do so, and one tag cannot be both strict and permissive because constraints
 * are combined, not overridden. Splitting them keeps the design system locked down and makes an
 * application's reach an explicit list rather than the absence of a tag. The file-level half of the
 * rule, that only `api.ts` may hold those imports, is `local/no-server-fns-in-components`.
 *
 * `apps/worker-jobs` carries `layer:server` because that is what it is: a queue and cron consumer
 * with no UI. It therefore cannot import `libs/ui` or any application code, which nothing asserted
 * while it carried no layer tag at all.
 */
export const depConstraints = [
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
  {
    sourceTag: 'layer:app-ui',
    onlyDependOnLibsWithTags: [
      'layer:ui',
      'layer:shared',
      'layer:server',
      'layer:domain',
      'layer:data',
    ],
  },
  {
    sourceTag: 'layer:ui',
    onlyDependOnLibsWithTags: ['layer:ui', 'layer:shared'],
  },
  {
    sourceTag: 'layer:server',
    onlyDependOnLibsWithTags: [
      'layer:server',
      'layer:domain',
      'layer:data',
      'layer:shared',
    ],
  },
  {
    sourceTag: 'layer:domain',
    onlyDependOnLibsWithTags: ['layer:domain', 'layer:shared'],
  },
  {
    sourceTag: 'layer:data',
    onlyDependOnLibsWithTags: ['layer:data', 'layer:shared'],
  },
  { sourceTag: 'layer:shared', onlyDependOnLibsWithTags: ['layer:shared'] },
];
