export const TURNSTILE_ACTIONS = {
  joinWaitlist: 'join_waitlist',
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];
