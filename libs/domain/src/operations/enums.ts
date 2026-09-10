export const CLOSEOUT_OUTCOMES = ['held', 'did_not_happen'] as const;
export const ATTENDANCE_OUTCOMES = ['attended', 'no_show'] as const;
export const FEEDBACK_RATINGS = ['valuable', 'okay', 'not_valuable'] as const;
export const HOST_TRUST_STATUSES = [
  'unreviewed',
  'verified',
  'restricted',
] as const;

export const HOST_FRICTIONS = [
  'venue',
  'scheduling',
  'promotion',
  'attendance',
  'format',
  'safety',
  'other_structured',
] as const;

export const OPERATION_REASONS = [
  'host_request',
  'member_dispute',
  'data_entry_error',
  'safety',
  'policy',
  'delivery_recovery',
] as const;

export const REVIEW_BOTTLENECKS = [
  'host_supply',
  'calendar_consistency',
  'venue_readiness',
  'discovery',
  'rsvp_conversion',
  'attendance',
  'event_quality',
  'return_behavior',
  'product_reliability',
] as const;

export const AUDIT_TARGETS = [
  'event',
  'user',
  'closeout',
  'attendance',
  'feedback',
  'host_trust',
  'operations_review',
] as const;

export const AUDIT_ACTIONS = [
  'closeout_submitted',
  'closeout_corrected',
  'attendance_recorded',
  'attendance_corrected',
  'host_trust_updated',
  'review_recorded',
] as const;
