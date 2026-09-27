import { useState, type FormEvent } from 'react';

import {
  brand,
  login_change_email,
  login_code_sent,
  login_account_note,
  login_email_continue,
  login_send_error,
  login_welcome,
  login_verify,
  code_error,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, StatusMessage, Turnstile } from '@founders-coffee/ui';

import { LegalNotice } from '../company/LegalNotice';
import { LoginEmailField } from './LoginEmailField';
import { authClient } from '../../lib/auth';
import { onboardingRedirectPath } from '../../lib/redirect';
import { OtpField, OTP_LENGTH } from './OtpField';
import { ResendButton } from './ResendButton';
import { SocialSignIn, type SocialProvider } from './SocialSignIn';
import { useResendCooldown } from './useResendCooldown';
import { useOtpAutofill } from './useOtpAutofill';
import { useStepHeightLock } from './useStepHeightLock';

type LoginPageProps = {
  locale: Locale;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
  socialProviders: readonly SocialProvider[];
  redirect: string;
};

export const LoginPage = ({
  locale,
  turnstileSiteKey,
  isTurnstileBypassed,
  socialProviders,
  redirect,
}: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendToken, setResendToken] = useState<string | null>(null);
  const [resendNonce, setResendNonce] = useState(0);
  const cooldown = useResendCooldown();
  const stepHeight = useStepHeightLock<HTMLFormElement>();

  const emailValid = /.+@.+\..+/.test(email);

  const sendCode = async () => {
    if (!emailValid || (!isTurnstileBypassed && !token)) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: 'sign-in' },
      { headers: { 'x-captcha-response': token } },
    );
    setBusy(false);
    if (sendError) {
      setError(login_send_error({}, { locale }));
      return;
    }
    stepHeight.lock();
    setStep('otp');
    cooldown.start();
  };

  const resend = async () => {
    if (!cooldown.isReady || !resendToken) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: 'sign-in' },
      { headers: { 'x-captcha-response': resendToken } },
    );
    setBusy(false);
    if (sendError) {
      setError(login_send_error({}, { locale }));
      return;
    }
    setOtp('');
    setResendToken(null);
    setResendNonce((nonce) => nonce + 1);
    cooldown.start();
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: verifyError } = await authClient.signIn.emailOtp({
      email,
      otp,
    });
    setBusy(false);
    if (verifyError) {
      setError(code_error({}, { locale }));
      return;
    }
    window.location.href = onboardingRedirectPath(locale, redirect);
  };

  const changeEmail = () => {
    setOtp('');
    setError(null);
    setResendToken(null);
    stepHeight.release();
    setStep('email');
  };

  const social = (provider: SocialProvider) =>
    authClient.signIn.social({
      provider,
      callbackURL: onboardingRedirectPath(locale, redirect),
      newUserCallbackURL: onboardingRedirectPath(locale, redirect),
    });

  const submitStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (step === 'email' ? sendCode() : verify());
  };

  useOtpAutofill(step === 'otp', setOtp);

  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-12">
      <div>
        <form
          ref={stepHeight.ref}
          style={{ minHeight: stepHeight.minHeight }}
          className="flex flex-col gap-4"
          onSubmit={submitStep}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-display text-h3 font-semibold">
              <span className="block">{login_welcome({}, { locale })}</span>
              <span className="block">{brand({}, { locale })}</span>
            </h1>
          </div>

          {step === 'email' ? (
            <>
              <LoginEmailField
                locale={locale}
                value={email}
                onChange={setEmail}
              />
              {turnstileSiteKey && !isTurnstileBypassed && (
                <Turnstile
                  sitekey={turnstileSiteKey}
                  language={locale}
                  onToken={setToken}
                />
              )}
              {error && <StatusMessage variant="error">{error}</StatusMessage>}
              <Button
                type="submit"
                disabled={
                  !emailValid || (!isTurnstileBypassed && !token) || busy
                }
                isFullWidth
              >
                {busy ? (
                  <span
                    className="loading loading-spinner loading-xs"
                    aria-hidden="true"
                  />
                ) : null}
                {login_email_continue({}, { locale })}
              </Button>
              <LegalNotice locale={locale} className="mt-1" />
              <p className="text-center text-body-sm font-medium text-base-content">
                {login_account_note({}, { locale })}
              </p>
              <SocialSignIn
                locale={locale}
                providers={socialProviders}
                isDisabled={busy}
                onSelect={(provider) => void social(provider)}
              />
            </>
          ) : (
            <>
              <p className="text-center text-body-sm text-neutral">
                {login_code_sent({ email }, { locale })}
              </p>
              <OtpField
                locale={locale}
                value={otp}
                hasError={!!error}
                isDisabled={busy}
                onChange={setOtp}
              />
              {error && <StatusMessage variant="error">{error}</StatusMessage>}
              <Button
                type="submit"
                disabled={otp.length !== OTP_LENGTH || busy}
                isFullWidth
              >
                {busy ? (
                  <span
                    className="loading loading-spinner loading-xs"
                    aria-hidden="true"
                  />
                ) : null}
                {login_verify({}, { locale })}
              </Button>
              <LegalNotice locale={locale} />
              {turnstileSiteKey && !isTurnstileBypassed && (
                <Turnstile
                  sitekey={turnstileSiteKey}
                  appearance="interaction-only"
                  language={locale}
                  resetKey={resendNonce}
                  onToken={setResendToken}
                />
              )}
              <ResendButton
                locale={locale}
                secondsLeft={cooldown.secondsLeft}
                isBusy={busy || !resendToken}
                onResend={() => void resend()}
              />
              <Button
                variant="link"
                onClick={changeEmail}
                disabled={busy}
                isFullWidth
              >
                {login_change_email({}, { locale })}
              </Button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
