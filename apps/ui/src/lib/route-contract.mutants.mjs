export default {
  command: 'npx vitest run src/lib/route-contract.test.ts',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'a new unprefixed route with no entry',
      expect: 'fail',
      edits: [
        {
          file: 'src/routeTree.gen.ts',
          find: "  interface FileRoutesByPath {\n    '/terms': {",
          replace:
            "  interface FileRoutesByPath {\n    '/pricing': {\n      id: '/pricing'\n      path: '/pricing'\n      fullPath: '/pricing'\n      preLoaderRoute: typeof TermsRouteImport\n      parentRoute: typeof rootRouteImport\n    }\n    '/terms': {",
        },
      ],
    },
    {
      name: "/login's entry deleted while the route stands",
      expect: 'fail',
      edits: [
        {
          file: 'src/lib/route-contract.test.ts',
          find: "  '/login': {\n    kind: 'unresolved',\n    why: '#58 — renders in the cookie language, so a French reader following a French link signs in in Arabic',\n  },\n",
          replace: '',
        },
      ],
    },
    {
      name: 'an entry for a route that does not exist',
      expect: 'fail',
      edits: [
        {
          file: 'src/lib/route-contract.test.ts',
          find: "  '/events.json': { kind: 'protocol', why: 'machine-readable feed' },",
          replace:
            "  '/gone': { kind: 'protocol', why: 'a route that was deleted' },\n  '/events.json': { kind: 'protocol', why: 'machine-readable feed' },",
        },
      ],
    },
    {
      name: 'an unresolved entry with no issue number',
      expect: 'fail',
      edits: [
        {
          file: 'src/lib/route-contract.test.ts',
          find: "why: '#58 — same as /login, behind requireSession',",
          replace: "why: 'we will get to it',",
        },
      ],
    },
    {
      name: 'a redirect stub given a component',
      expect: 'fail',
      edits: [
        {
          file: 'src/routes/terms.tsx',
          find: "  beforeLoad: companyRedirect('terms'),",
          replace:
            "  component: () => null,\n  beforeLoad: companyRedirect('terms'),",
        },
      ],
    },
    {
      name: 'a redirect stub stripped of its beforeLoad',
      expect: 'fail',
      edits: [
        {
          file: 'src/routes/closeout.$eventId.tsx',
          find: '  beforeLoad: ',
          replace: '  loader: ',
        },
      ],
    },
    {
      name: 'the generated tree mangled so the parse returns nothing',
      expect: 'fail',
      edits: [
        {
          file: 'src/routeTree.gen.ts',
          find: 'preLoaderRoute: typeof',
          replace: 'preLoaderRouteX: typeof',
          all: true,
        },
      ],
    },
  ],
};
