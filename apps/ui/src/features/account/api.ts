import {
  confirmMyEmailChange,
  confirmMyPhoneNumber,
  getMyAccount,
  requestMyEmailChange,
  sendMyEmailChangeCode,
  sendMyPhoneCode,
} from '@founders-coffee/server-fns';
import type { AccountSummary } from '@founders-coffee/server-fns';

export type ContactAccepted = { accepted: true };
export type EmailChangeInput = {
  newEmail: string;
  otp: string;
  turnstileToken?: string;
};
export type PhoneCodeInput = { phoneNumber: string; turnstileToken?: string };
export type PhoneConfirmInput = PhoneCodeInput & { otp: string };

export const accountApi = {
  getMyAccount: (): Promise<AccountSummary> => getMyAccount({ data: {} }),
  sendEmailChangeCode: (data: {
    turnstileToken?: string;
  }): Promise<ContactAccepted> => sendMyEmailChangeCode({ data }),
  requestEmailChange: (data: EmailChangeInput): Promise<ContactAccepted> =>
    requestMyEmailChange({ data }),
  confirmEmailChange: (data: EmailChangeInput): Promise<ContactAccepted> =>
    confirmMyEmailChange({ data }),
  sendPhoneCode: (data: PhoneCodeInput): Promise<ContactAccepted> =>
    sendMyPhoneCode({ data }),
  confirmPhoneNumber: (data: PhoneConfirmInput): Promise<ContactAccepted> =>
    confirmMyPhoneNumber({ data }),
};

export type { AccountSummary };
