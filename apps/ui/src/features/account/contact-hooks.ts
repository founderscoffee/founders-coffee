import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  accountApi,
  type ContactAccepted,
  type EmailChangeInput,
  type PhoneCodeInput,
  type PhoneConfirmInput,
} from './api';

const useContactMutation = <TInput>(
  call: (input: TInput) => Promise<ContactAccepted>,
) => {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: ['account', 'summary'] }),
  });
};

export const useSendEmailChangeCode = () =>
  useContactMutation((input: { turnstileToken?: string }) =>
    accountApi.sendEmailChangeCode(input),
  );

export const useRequestEmailChange = () =>
  useContactMutation((input: EmailChangeInput) =>
    accountApi.requestEmailChange(input),
  );

export const useConfirmEmailChange = () =>
  useContactMutation((input: EmailChangeInput) =>
    accountApi.confirmEmailChange(input),
  );

export const useSendPhoneCode = () =>
  useContactMutation((input: PhoneCodeInput) =>
    accountApi.sendPhoneCode(input),
  );

export const useConfirmPhoneNumber = () =>
  useContactMutation((input: PhoneConfirmInput) =>
    accountApi.confirmPhoneNumber(input),
  );
