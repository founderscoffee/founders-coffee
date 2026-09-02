import {
  joinWaitlist,
  type JoinWaitlistInput,
  type JoinWaitlistRequest,
} from '@founders-coffee/server-fns';

export const waitlistApi = {
  joinWaitlist,
};

export type { JoinWaitlistInput, JoinWaitlistRequest };
export type JoinWaitlistArgs = { data: JoinWaitlistRequest };
