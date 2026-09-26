import type { AnyRoute } from '@tanstack/react-router';

/**
 * Hang one of the app's own routes under a parent, the way `routeTree.gen.ts` does.
 *
 * The generated tree calls `update({ id, path, getParentRoute })`, and `update` is an
 * `Object.assign` onto the route's options. Its type admits none of those three keys, which the
 * generated file gets past with `as any`; assigning them here is the same act, and stays typed.
 */
export const hang = <TRoute extends AnyRoute>(
  route: TRoute,
  path: string,
  parent: AnyRoute,
): TRoute => {
  Object.assign(route.options, {
    id: path,
    path,
    getParentRoute: () => parent,
  });
  return route;
};
