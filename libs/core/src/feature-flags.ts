/**
 * Per-market feature flags (AGENTS.md §8.4 — gates which engines are active per market).
 * Pure: the actual flag values come from market config (server layer); core only defines
 * the shape and a reader.
 */
export const FEATURE_FLAGS = [
  'events',
  'hackathons',
  'payments',
  'recruiting',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

/** Read a single flag from a market's flag set. */
export function isFeatureEnabled(
  flags: FeatureFlags,
  flag: FeatureFlag,
): boolean {
  return flags[flag];
}

/** Convenience: all flags off (used for `dark` markets). */
export function allFlagsOff(): FeatureFlags {
  return { events: false, hackathons: false, payments: false, recruiting: false };
}
