import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/**
 * Every route the generator declared, paired with the file it came from.
 *
 * Read out of `routeTree.gen.ts` as text rather than by importing it. Importing would pull in every
 * route module and everything they render, to answer a question about addresses; the generated file
 * already states the answer, and it is regenerated and committed by `nx sync`, so reading it is
 * reading the same source of truth the router uses.
 */
export const declaredRoutes = (): { fullPath: string; file: string }[] => {
  const source = read('../routeTree.gen.ts');
  const imports = new Map(
    [
      ...source.matchAll(/import \{ Route as (\w+) \} from '\.\/([^']+)'/gu),
    ].map((match) => [match[1] as string, match[2] as string]),
  );

  const declarations = source.slice(
    source.indexOf('interface FileRoutesByPath {'),
  );
  return [
    ...declarations.matchAll(
      /fullPath: '([^']*)'\s*preLoaderRoute: typeof (\w+)/gu,
    ),
  ].map((match) => ({
    fullPath: match[1] as string,
    file: imports.get(match[2] as string) ?? '',
  }));
};

export const sourceOf = (file: string): string => {
  for (const extension of ['.tsx', '.ts'])
    try {
      return read(`../${file}${extension}`);
    } catch {
      continue;
    }
  return '';
};
