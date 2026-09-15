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
import type { AuthEnv } from '@founders-coffee/auth';

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
  submittedCode: string,
  isEmail: boolean,
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

  const candidate = isEmail ? await hashEmailOtp(submittedCode) : submittedCode;
  if (candidate === storedCode || (isEmail && submittedCode === storedCode))
    return { verification };

  await updateContactVerificationValue(
    db,
    verification.id,
    `${storedCode}:${attempts + 1}`,
  );
  return { failure: { code: 'contact_code_invalid' } };
};

const emailIdentifier = (type: string, email: string): string =>
  `${type}-otp-${email.toLowerCase()}`;

/** Check contact failures that would otherwise surface as Better Auth orphan rejections. */
export const preflightContactFailure = async (
  env: AuthEnv,
  userId: string,
  path: string,
  body: Record<string, unknown>,
): Promise<ContactPreflightFailure | undefined> => {
  const db = createDb(env.DB);
  const currentUser = await getUser(db, userId);
  if (!currentUser) return { code: 'contact_code_invalid' };

  if (path === '/email-otp/request-email-change') {
    return (
      await checkVerification(
        db,
        emailIdentifier('email-verification', currentUser.email),
        String(body.otp ?? ''),
        true,
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
      String(body.otp ?? ''),
      true,
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
      String(body.code ?? ''),
      false,
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
