import {
  createDb,
  deleteContactVerifications,
  getUser,
  getLatestContactVerification,
  hasUserWithEmail,
  hasUserWithPhone,
  updateContactVerificationValue,
  type ContactVerification,
} from '@founders-coffee/db';
import type { AuthEnv, SmsProvider } from '@founders-coffee/auth';

export interface ContactPreflightFailure {
  readonly code:
    | 'contact_code_invalid'
    | 'contact_code_expired'
    | 'contact_taken'
    | 'rate_limited';
}

interface VerificationCheck {
  readonly failure?: ContactPreflightFailure;
  readonly verification?: ContactVerification;
}

type CodeCheck = (storedCode: string) => Promise<boolean>;

const MAX_ATTEMPTS = 3;

const splitStoredValue = (value: string): readonly [string, number] => {
  const index = value.lastIndexOf(':');
  if (index === -1) return [value, 0];
  const attempts = Number.parseInt(value.slice(index + 1), 10);
  return [value.slice(0, index), Number.isFinite(attempts) ? attempts : 0];
};

const hashEmailOtp = async (otp: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(otp),
  );
  let binary = '';
  for (const byte of new Uint8Array(digest))
    binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
};

const checkVerification = async (
  db: ReturnType<typeof createDb>,
  identifier: string,
  isSubmittedCode: CodeCheck,
): Promise<VerificationCheck> => {
  const verification = await getLatestContactVerification(db, identifier);
  if (!verification) return { failure: { code: 'contact_code_invalid' } };
  if (verification.expiresAt <= new Date()) {
    await deleteContactVerifications(db, verification.identifier);
    return { failure: { code: 'contact_code_expired' } };
  }

  const [storedCode, attempts] = splitStoredValue(verification.value);
  if (attempts >= MAX_ATTEMPTS) {
    await deleteContactVerifications(db, verification.identifier);
    return { failure: { code: 'rate_limited' } };
  }

  if (await isSubmittedCode(storedCode)) return { verification };

  await updateContactVerificationValue(
    db,
    verification.id,
    `${storedCode}:${attempts + 1}`,
  );
  return { failure: { code: 'contact_code_invalid' } };
};

const emailCode =
  (submittedCode: string): CodeCheck =>
  async (storedCode) =>
    (await hashEmailOtp(submittedCode)) === storedCode ||
    submittedCode === storedCode;

/**
 * Check a phone code against whichever side made it.
 *
 * A provider with `verifyOtp` texts a code of its own, as Twilio Verify does, so the code Better
 * Auth stored never reached the phone: only the provider can say whether the submitted code is the
 * one the member received, and the stored one must not pass. The stored row still decides whether a
 * check happens at all (it has to exist, be unexpired and have attempts left), and a wrong code
 * still spends an attempt. A provider without `verifyOtp` texts the stored code itself.
 */
const phoneCode =
  (
    smsProvider: SmsProvider,
    phoneNumber: string,
    submittedCode: string,
  ): CodeCheck =>
  async (storedCode) =>
    smsProvider.verifyOtp
      ? smsProvider.verifyOtp({ phoneNumber, code: submittedCode })
      : submittedCode === storedCode;

const emailIdentifier = (type: string, email: string): string =>
  `${type}-otp-${email.toLowerCase()}`;

/**
 * Check contact failures that would otherwise surface as Better Auth orphan rejections.
 *
 * `smsProvider` has to be the provider Better Auth is given for the same request: when it owns the
 * phone code, this is where it is asked first.
 */
export const preflightContactFailure = async (
  env: AuthEnv,
  userId: string,
  path: string,
  body: Record<string, unknown>,
  smsProvider: SmsProvider,
): Promise<ContactPreflightFailure | undefined> => {
  const db = createDb(env.DB);
  const currentUser = await getUser(db, userId);
  if (!currentUser) return { code: 'contact_code_invalid' };

  if (path === '/email-otp/request-email-change') {
    return (
      await checkVerification(
        db,
        emailIdentifier('email-verification', currentUser.email),
        emailCode(String(body.otp ?? '')),
      )
    ).failure;
  }

  if (path === '/email-otp/change-email') {
    const check = await checkVerification(
      db,
      emailIdentifier(
        'change-email',
        `${currentUser.email}-${String(body.newEmail ?? '').toLowerCase()}`,
      ),
      emailCode(String(body.otp ?? '')),
    );
    if (check.failure) return check.failure;
    if (await hasUserWithEmail(db, String(body.newEmail ?? ''))) {
      if (check.verification)
        await deleteContactVerifications(db, check.verification.identifier);
      return { code: 'contact_taken' };
    }
    return undefined;
  }

  if (path === '/phone-number/verify') {
    const phoneNumber = String(body.phoneNumber ?? '');
    const check = await checkVerification(
      db,
      phoneNumber,
      phoneCode(smsProvider, phoneNumber, String(body.code ?? '')),
    );
    if (check.failure) return check.failure;
    if (await hasUserWithPhone(db, phoneNumber)) {
      if (check.verification)
        await deleteContactVerifications(db, check.verification.identifier);
      return { code: 'contact_taken' };
    }
  }

  return undefined;
};
