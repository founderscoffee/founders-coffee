export type StatusVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * The live-region role a message of this severity takes.
 *
 * An error or a warning interrupts, because something went wrong or is about to and the reader
 * needs to know now. Success and information wait for a pause in what the screen reader is saying.
 * The Toast made this split first; it is stated once here so that an inline message and a toast
 * carrying the same news cannot come to disagree about how urgently to say it.
 */
export const statusRole = (variant: StatusVariant): 'alert' | 'status' =>
  variant === 'error' || variant === 'warning' ? 'alert' : 'status';
