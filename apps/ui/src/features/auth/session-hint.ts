const KEY = 'fc_auth_slot';

/**
 * A boolean this browser remembers so the header can size its auth control before it knows who
 * you are.
 *
 * The session is resolved by a fetch after hydration, because the document is shared-cached and
 * must not carry anybody's identity. That leaves the control's width unknown at paint: signed out
 * it is a sign-in button, signed in it is a 32px avatar, and in Arabic those differ by 105px. The
 * header cannot reserve one width for both — reserving the button's leaves a signed-in reader an
 * empty corner, and reserving the avatar's pushes the host CTA sideways when the session lands.
 *
 * So the browser remembers which one it needed last time. This is a layout hint and nothing else:
 * it holds no identity, grants no access, and is read only to pick a width. A stale or missing
 * value costs exactly what today already costs — one shift — which is why it is safe to keep
 * somewhere a script can read, and why the real control still waits for the real session.
 *
 * Storage is unavailable in some privacy modes and throws rather than returning null, so every
 * access is guarded and an unreadable store is treated as a first visit, which is signed out.
 *
 * When the hint turns out to be wrong — a signed-in reader on a browser that has never been here,
 * or one that has been cleared — the header corrects the attribute as soon as the session answers.
 * That costs one shift, which is exactly what every load cost before any of this existed, and it
 * buys back the alternative: a reserved width with a 32px avatar in it, leaving a hole in the
 * corner for the rest of the visit. From the next page load the hint is right and neither happens.
 */
export type AuthSlot = 'in' | 'out';

export const AUTH_SLOT_KEY = KEY;

export const readAuthSlot = (): AuthSlot => {
  try {
    return window.localStorage.getItem(KEY) === 'in' ? 'in' : 'out';
  } catch {
    return 'out';
  }
};

export const writeAuthSlot = (slot: AuthSlot): void => {
  try {
    window.localStorage.setItem(KEY, slot);
  } catch {
    return;
  }
};

/**
 * The same read, as source for a script that must run before the first paint.
 *
 * The document ships with `data-auth-slot="out"` already on it, so the reservation is correct for
 * a first visit and for a browser running no script at all; this only flips it for a browser that
 * remembers being signed in. React is told to suppress the hydration warning on `<html>`, because
 * the attribute legitimately differs from what the server sent — that difference is the whole
 * point, and React leaves it in place rather than patching it back.
 *
 * React cannot do this job. Its first client render has to match the server's or hydration throws
 * the tree away, and the server has no way to know what this browser remembers — so anything React
 * renders from storage is a second paint, which is the shift being avoided. Setting an attribute on
 * the document outside React's tree sidesteps that: the stylesheet has the answer before the first
 * frame, and React never sees the attribute at all.
 */
export const AUTH_SLOT_SCRIPT = `try{document.documentElement.dataset.authSlot=localStorage.getItem('${KEY}')==='in'?'in':'out'}catch(e){document.documentElement.dataset.authSlot='out'}`;
