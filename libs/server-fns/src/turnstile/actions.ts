export const TURNSTILE_ACTIONS = {
  createEvent: 'create_event',
  joinWaitlist: 'join_waitlist',
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];
