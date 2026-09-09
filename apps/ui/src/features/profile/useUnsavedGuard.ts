import { useBlocker } from '@tanstack/react-router';

/**
 * Hold a navigation until the member decides what to do with edits they have not saved.
 *
 * A profile edit is a small amount of typing that is easy to lose and annoying to redo, and the
 * ways to lose it are all one click: a nav link, the back button, a locale switch that re-routes,
 * or closing the tab. `enableBeforeUnload` covers the browser-level exits, which the router cannot
 * intercept, and the resolver covers in-app navigation so the answer can be a real control rather
 * than a browser dialog nobody can style or translate.
 *
 * The blocker is disabled rather than conditional inside `shouldBlockFn` so that a clean form never
 * arms `beforeunload` — an armed handler makes some browsers slow the page's unload path even when
 * it answers "let them go".
 */
export const useUnsavedGuard = (isDirty: boolean) => {
  const blocker = useBlocker({
    shouldBlockFn: () => true,
    enableBeforeUnload: () => isDirty,
    disabled: !isDirty,
    withResolver: true,
  });

  return {
    isBlocked: blocker.status === 'blocked',
    leave: () => blocker.proceed?.(),
    stay: () => blocker.reset?.(),
  };
};
