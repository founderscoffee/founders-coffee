/**
 * The module-boundary contract (AGENTS.md §4, implementation-plan §5).
 *
 * Every project is tagged `type:app|lib`, `layer:ui|server|domain|data|shared`, `domain:<name>`.
 * The layer constraints below enforce the one-directional data flow:
 *
 *   Component -> hook -> api -> server-fn -> domain -> db -> D1
 *
 * A violation is a build-breaking lint error, never a warning.
 */
export const depConstraints = [
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
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
