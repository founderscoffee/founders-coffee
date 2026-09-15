export const TURNSTILE_ACTIONS = {
  joinWaitlist: 'join_waitlist',
  updateProfile: 'update_profile',
  submitFeedback: 'submit_feedback',
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];
