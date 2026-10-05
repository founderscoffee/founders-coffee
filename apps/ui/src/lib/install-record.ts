import { z } from 'zod';

const KEY = 'fc_install_prompt';

const installRecordSchema = z.object({
  firstSeenAt: z.number().int().nonnegative(),
  outcome: z.enum(['dismissed', 'installed']).nullable(),
});

export type InstallRecord = z.infer<typeof installRecordSchema>;

export type InstallOutcome = NonNullable<InstallRecord['outcome']>;

export const INSTALL_RECORD_KEY = KEY;

/**
 * The stored record, or null when there is none or it is not one this code wrote.
 */
const parseRecord = (stored: string | null): InstallRecord | null => {
  if (stored === null) return null;
  try {
    const parsed = installRecordSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * What this browser remembers about the install sheet, started on its first visit.
 *
 * The record holds two things and never leaves the device: when the browser first opened the site,
 * which is how a second visit is recognised, and how the sheet was answered, which closes it for
 * good. Null when the browser cannot keep it, as some privacy modes signal by throwing. The sheet
 * stays closed there, because a "No thanks" it cannot remember would bring it back on the next page.
 */
export const readInstallRecord = (now: number): InstallRecord | null => {
  try {
    const stored = parseRecord(localStorage.getItem(KEY));
    if (stored) return stored;
    const started: InstallRecord = { firstSeenAt: now, outcome: null };
    localStorage.setItem(KEY, JSON.stringify(started));
    return started;
  } catch {
    return null;
  }
};

/**
 * Closes the install sheet on this browser for good, whichever way it was answered.
 */
export const recordInstallOutcome = (
  outcome: InstallOutcome,
  now: number,
): void => {
  try {
    const stored = parseRecord(localStorage.getItem(KEY));
    const answered: InstallRecord = {
      firstSeenAt: stored?.firstSeenAt ?? now,
      outcome,
    };
    localStorage.setItem(KEY, JSON.stringify(answered));
  } catch {
    return;
  }
};
