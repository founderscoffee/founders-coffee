const SERVER_LAYERS = ['@founders-coffee/server-fns', '@founders-coffee/db'];

const DOMAIN = '@founders-coffee/domain';

const GUARDED_PATH = /\/src\/(components|lib|features)\//;

const FEATURE_API = /\/src\/features\/[^/]+\/api\.tsx?$/;

const FEATURE_COMPONENT = /\/src\/features\/[^/]+\/components\//;

const isFeatureLogic = (filename) =>
  /\/src\/features\//.test(filename) && !FEATURE_COMPONENT.test(filename);

/**
 * Nothing may reach past the `api.ts` layer at runtime (AGENTS.md §3, §4, §16).
 *
 * `features/` is guarded alongside `components/` and `lib/` because §3 governs it identically: a
 * feature's modules call `hooks.ts`, which calls `api.ts`, which is the one module allowed to
 * import `libs/server-fns`. Leaving `features/` out was not a narrower rule but an invisible hole —
 * `features/push/client.ts` imported two server functions directly for as long as it existed, and
 * nothing reported it.
 *
 * `libs/domain` is treated differently from the server layers, and deliberately. §16 keeps it out
 * of components, but §6 requires the opposite of the form layer: "the schema is the single contract
 * shared by api.ts, server functions, and forms". Banning it in `features/` would force the wizard
 * to restate constraints the domain already owns, which is the duplication §6 exists to prevent.
 * So feature logic may import it; a feature's own components may not.
 *
 * Type-only imports are allowed everywhere: they carry no runtime edge and erase at build.
 */
export const noServerFnsInComponents = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      server:
        'Only features/<domain>/api.ts may import {{source}} at runtime — go through the hooks/api layer. Type-only imports are allowed. (AGENTS.md §3, §4)',
      domain:
        'Components must not import {{source}} at runtime — take the value from a hook or from feature logic. Type-only imports are allowed. (AGENTS.md §16)',
    },
  },
  create: (context) => {
    const filename = context.filename ?? context.getFilename();
    if (!GUARDED_PATH.test(filename)) return {};
    if (FEATURE_API.test(filename)) return {};

    const allowsDomain = isFeatureLogic(filename);

    return {
      ImportDeclaration: (node) => {
        if (node.importKind === 'type') return;
        const source = node.source.value;
        const matches = (banned) =>
          source === banned || source.startsWith(banned + '/');

        if (SERVER_LAYERS.some(matches)) {
          context.report({ node, messageId: 'server', data: { source } });
          return;
        }
        if (!allowsDomain && matches(DOMAIN)) {
          context.report({ node, messageId: 'domain', data: { source } });
        }
      },
    };
  },
};
