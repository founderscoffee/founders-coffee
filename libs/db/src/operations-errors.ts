export type OperationsErrorCode =
  | 'event_not_ended'
  | 'event_no_end_time'
  | 'event_cancelled'
  | 'not_event_host'
  | 'attendee_not_eligible'
  | 'closeout_already_recorded'
  | 'closeout_not_recorded'
  | 'closeout_stale_version'
  | 'feedback_not_attended'
  | 'feedback_not_invited'
  | 'feedback_window_closed'
  | 'operations_disabled';

export const OPERATIONS_ERROR_CODES: readonly OperationsErrorCode[] = [
  'event_not_ended',
  'event_no_end_time',
  'event_cancelled',
  'not_event_host',
  'attendee_not_eligible',
  'closeout_already_recorded',
  'closeout_not_recorded',
  'closeout_stale_version',
  'feedback_not_attended',
  'feedback_not_invited',
  'feedback_window_closed',
  'operations_disabled',
];

/**
 * Whether a string is one of the refusals every CO surface must use.
 *
 * The repositories return outcome strings and the server functions turn them into `AppError`s;
 * without a shared list those two vocabularies drift, and a member sees "not eligible" on one
 * screen and "ineligible attendee" on another for the same refusal. CO-05 through CO-09 map from
 * this list rather than inventing codes, and the localized copy is keyed off it.
 *
 * Internal codes stay untranslated (§5.15). What a member reads is a message chosen by locale; what
 * a log records is one of these.
 */
export const isOperationsErrorCode = (
  code: string,
): code is OperationsErrorCode =>
  (OPERATIONS_ERROR_CODES as readonly string[]).includes(code);
