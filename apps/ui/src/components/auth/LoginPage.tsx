import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  brand,
  login_change_email,
  login_code_sent,
  login_email_label,
  login_email_placeholder,
  login_help,
  login_or,
  login_send_code,
  login_send_error,
  login_title,
  login_verify,
  login_wrong_code,
  oauth_continue,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Input, LogoSymbol, Turnstile } from '@founders-coffee/ui';

import { LegalNotice } from '../company/LegalNotice';
import { authClient } from '../../lib/auth';
import { onboardingRedirectPath } from '../../lib/redirect';
import { OtpField, OTP_LENGTH } from './OtpField';
import { PROVIDER_MARK } from './ProviderIcon';
import { ResendButton } from './ResendButton';
import { useResendCooldown } from './useResendCooldown';
import { useOtpAutofill } from './useOtpAutofill';
import { useStepHeightLock } from './useStepHeightLock';

const OAUTH_PROVIDERS = ['google', 'github'] as const;

const PROVIDER_LABEL: Record<(typeof OAUTH_PROVIDERS)[number], string> = {
  google: 'Google',
  github: 'GitHub',
};

type LoginPageProps = {
  locale: Locale;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
  hasSocial: boolean;
  redirect: string;
};

export const LoginPage = ({
  locale,
  turnstileSiteKey,
  isTurnstileBypassed,
  hasSocial,
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
  const stepHeight = useStepHeightLock();

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
      setError(login_wrong_code({}, { locale }));
      return;
    }
    window.location.href = onboardingRedirectPath(redirect);
  };

  const changeEmail = () => {
    setOtp('');
    setError(null);
    setResendToken(null);
    stepHeight.release();
    setStep('email');
  };

  const social = (provider: (typeof OAUTH_PROVIDERS)[number]) =>
    authClient.signIn.social({
      provider,
      callbackURL: onboardingRedirectPath(redirect),
      newUserCallbackURL: onboardingRedirectPath(redirect),
    });

  useOtpAutofill(step === 'otp', setOtp);

  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-12">
      <div>
        <div
          ref={stepHeight.ref}
          style={{ minHeight: stepHeight.minHeight }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <Link
              to="/"
              aria-label={brand({}, { locale })}
              className="rounded-full"
            >
              <LogoSymbol size={40} hasLettering />
            </Link>
            <h1 className="font-display text-h3 font-semibold">
              {login_title({}, { locale })}
            </h1>
          </div>

          {step === 'email' ? (
            <>
              <label className="form-control">
                <span className="mb-1 block text-label text-neutral">
                  {login_email_label({}, { locale })}
                </span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={login_email_placeholder({}, { locale })}
                />
                <span className="mt-1.5 block text-body-sm text-neutral">
                  {login_help({}, { locale })}
                </span>
              </label>
              {turnstileSiteKey && !isTurnstileBypassed && (
                <Turnstile sitekey={turnstileSiteKey} onToken={setToken} />
              )}
              {error && (
                <p role="alert" className="text-body-sm text-error">
                  {error}
                </p>
              )}
              <Button
                onClick={sendCode}
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
                {login_send_code({}, { locale })}
              </Button>
              <LegalNotice locale={locale} className="mt-1" />
              {hasSocial && (
                <>
                  <div className="divider text-caption text-neutral">
                    {login_or({}, { locale })}
                  </div>
                  <div className="space-y-2">
                    {OAUTH_PROVIDERS.map((p) => {
                      const Mark = PROVIDER_MARK[p];
                      return (
                        <Button
                          key={p}
                          variant="outline"
                          onClick={() => social(p)}
                          disabled={busy}
                          isFullWidth
                        >
                          <Mark />
                          {oauth_continue(
                            { provider: PROVIDER_LABEL[p] },
                            { locale },
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}
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
              {error && (
                <p role="alert" className="text-center text-body-sm text-error">
                  {error}
                </p>
              )}
              <Button
                onClick={verify}
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
        </div>
      </div>
    </div>
  );
};
