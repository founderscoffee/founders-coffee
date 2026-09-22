import { useRef, useState, type FormEvent } from 'react';

import {
  gate_back,
  gate_title,
  login_change_email,
  login_code_sent,
  login_email_label,
  login_email_placeholder,
  login_or,
  login_send_code,
  login_send_error,
  login_verify,
  login_wrong_code,
  oauth_continue,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Input, Turnstile } from '@founders-coffee/ui';

import { LegalNotice } from '../company/LegalNotice';
import { authClient } from '../../lib/auth';
import { OtpField, OTP_LENGTH } from '../auth/OtpField';
import { BackArrow, PROVIDER_MARK } from '../auth/ProviderIcon';
import { ResendButton } from '../auth/ResendButton';
import { useResendCooldown } from '../auth/useResendCooldown';
import { useStepHeightLock } from '../auth/useStepHeightLock';
import { useRevealOnMount } from './useRevealOnMount';

const OAUTH_PROVIDERS = ['google', 'github'] as const;

const PROVIDER_LABEL: Record<(typeof OAUTH_PROVIDERS)[number], string> = {
  google: 'Google',
  github: 'GitHub',
};

type HostSignInGateProps = {
  locale: Locale;
  turnstileSiteKey: string | null;
  hasSocial: boolean;
  onCancel: () => void;
  onAuthenticated: () => void;
};

export const HostSignInGate = ({
  locale,
  turnstileSiteKey,
  hasSocial,
  onCancel,
  onAuthenticated,
}: HostSignInGateProps) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendToken, setResendToken] = useState<string | null>(null);
  const [resendNonce, setResendNonce] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const cooldown = useResendCooldown();
  const stepHeight = useStepHeightLock<HTMLFormElement>();

  const submitStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (step === 'email' ? sendCode() : verify());
  };

  useRevealOnMount(rootRef);

  const emailValid = /.+@.+\..+/.test(email);

  const sendCode = async () => {
    if (!emailValid || !token) return;
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
    onAuthenticated();
  };

  const changeEmail = () => {
    setOtp('');
    setError(null);
    setResendToken(null);
    stepHeight.release();
    setStep('email');
  };

  const social = (provider: (typeof OAUTH_PROVIDERS)[number]) => {
    const here = `${window.location.pathname}${window.location.search}`;
    return authClient.signIn.social({
      provider,
      callbackURL: here,
      newUserCallbackURL: here,
    });
  };

  return (
    <div
      ref={rootRef}
      className="mt-6 rounded-box border border-base-300 bg-base-200 p-5 md:p-6"
    >
      <h3 className="font-display text-h4 font-semibold text-base-content">
        {gate_title({}, { locale })}
      </h3>

      <form
        ref={stepHeight.ref}
        style={{ minHeight: stepHeight.minHeight }}
        className="mt-5 flex max-w-sm flex-col gap-4"
        onSubmit={submitStep}
      >
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
            </label>
            {turnstileSiteKey && (
              <Turnstile sitekey={turnstileSiteKey} onToken={setToken} />
            )}
            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={!emailValid || !token || busy}
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
            <LegalNotice locale={locale} />
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
                        onClick={() => void social(p)}
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
            <p className="text-body-sm text-neutral">
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
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}
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
            {turnstileSiteKey && (
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
        <Button variant="ghost" onClick={onCancel} disabled={busy} isFullWidth>
          <BackArrow locale={locale} />
          {gate_back({}, { locale })}
        </Button>
      </form>
    </div>
  );
};
