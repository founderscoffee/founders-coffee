import { joinWaitlist, type JoinWaitlistInput } from '@founders-coffee/server-fns'

export const waitlistApi = {
  joinWaitlist,
}

export type { JoinWaitlistInput }
export type JoinWaitlistArgs = { data: JoinWaitlistInput }
