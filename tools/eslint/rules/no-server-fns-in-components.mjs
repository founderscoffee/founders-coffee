const BANNED = [
  '@founders-coffee/server-fns',
  '@founders-coffee/db',
  '@founders-coffee/domain',
];

/**
 * Components and app bootstrap must not reach past the `api.ts` layer at runtime (AGENTS.md §4).
 * Type-only imports are allowed: they carry no runtime edge and erase at build.
 *
 * Known coverage gap, tracked as AR-12: the path test below misses
 * `features/<domain>/components/`, which §3 governs identically.
 */
export const noServerFnsInComponents = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      noServerFns:
        'Components/lib must not import {{source}} at runtime — use the hooks/api layer (features/*/hooks.ts). Type-only imports are allowed. (AGENTS.md §4)',
    },
  },
  create: (context) => {
    const filename = context.filename ?? context.getFilename();
    if (!/\/src\/(components|lib)\//.test(filename)) return {};

    return {
      ImportDeclaration: (node) => {
        if (node.importKind === 'type') return;
        const source = node.source.value;
        if (BANNED.some((b) => source === b || source.startsWith(b + '/'))) {
          context.report({ node, messageId: 'noServerFns', data: { source } });
        }
      },
    };
  },
};
