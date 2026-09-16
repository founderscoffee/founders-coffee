import {
  confirmMyEmailChange,
  getMyDevices,
  revokeMyDevice,
  unlinkMyProvider,
  confirmMyPhoneNumber,
  getMyAccount,
  requestMyEmailChange,
  sendMyEmailChangeCode,
  sendMyPhoneCode,
} from '@founders-coffee/server-fns';
import type { AccountSummary, DeviceList } from '@founders-coffee/server-fns';

export type ContactAccepted = { accepted: true };
export type EmailChangeInput = {
  newEmail: string;
  otp: string;
};
export type PhoneCodeInput = { phoneNumber: string };
export type PhoneConfirmInput = PhoneCodeInput & { otp: string };

export const accountApi = {
  getMyDevices: (): Promise<DeviceList> => getMyDevices({ data: {} }),
  revokeDevice: (data: {
    sessionId?: string;
    othersOnly?: boolean;
  }): Promise<{ revoked: number }> => revokeMyDevice({ data }),
  unlinkProvider: (data: { providerId: string }): Promise<{ unlinked: true }> =>
    unlinkMyProvider({ data: data as { providerId: 'google' } }),
  getMyAccount: (): Promise<AccountSummary> => getMyAccount({ data: {} }),
  sendEmailChangeCode: (): Promise<ContactAccepted> =>
    sendMyEmailChangeCode({ data: {} }),
  requestEmailChange: (data: EmailChangeInput): Promise<ContactAccepted> =>
    requestMyEmailChange({ data }),
  confirmEmailChange: (data: EmailChangeInput): Promise<ContactAccepted> =>
    confirmMyEmailChange({ data }),
  sendPhoneCode: (data: PhoneCodeInput): Promise<ContactAccepted> =>
    sendMyPhoneCode({ data }),
  confirmPhoneNumber: (data: PhoneConfirmInput): Promise<ContactAccepted> =>
    confirmMyPhoneNumber({ data }),
};

export type { AccountSummary, DeviceList };
