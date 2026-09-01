export type OtpType =
  'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export interface SendOtpArgs {
  email: string;
  otp: string;
  type: OtpType;
}

export interface EmailProvider {
  sendOtp(args: SendOtpArgs): void | Promise<void>;
}

export class DevEmailProvider implements EmailProvider {
  readonly sent: SendOtpArgs[] = [];

  sendOtp = (args: SendOtpArgs): void => {
    this.sent.push(args);
    console.log(
      `[DevEmailProvider] email-OTP for ${args.email} (${args.type}): ${args.otp}`,
    );
  };
}
