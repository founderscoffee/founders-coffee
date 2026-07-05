import { useMutation } from '@tanstack/react-query'

import { waitlistApi, type JoinWaitlistArgs } from './api'

export const useJoinWaitlist = () =>
  useMutation({
    mutationFn: (input: JoinWaitlistArgs) => waitlistApi.joinWaitlist(input),
  })
