import { useState } from 'react';

import {
  gate_back,
  gate_body,
  gate_title,
  login_code_label,
  login_code_sent,
  login_email_label,
  login_email_placeholder,
  login_or,
  login_resend,
  login_send_code,
  login_send_error,
  login_verify,
  login_wrong_code,
  oauth_continue,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Input } from '@founders-coffee/ui';

import { LegalNotice } from '../company/LegalNotice';
import { authClient } from '../../lib/auth';
import { Turnstile } from '../auth/Turnstile';

const OAUTH_PROVIDERS = ['google', 'github', 'linkedin'] as const;

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
    setStep('otp');
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

  const social = (provider: (typeof OAUTH_PROVIDERS)[number]) => {
    const here = `${window.location.pathname}${window.location.search}`;
    return authClient.signIn.social({
      provider,
      callbackURL: here,
      newUserCallbackURL: here,
    });
  };

  return (
    <div className="mt-6 rounded-box border border-base-300 bg-base-200 p-5 md:p-6">
      <h3 className="font-display text-h4 font-semibold text-base-content">
        {gate_title({}, { locale })}
      </h3>
      <p className="mt-1 text-body-sm text-neutral">
        {gate_body({}, { locale })}
      </p>

      <div className="mt-5 flex max-w-sm flex-col gap-4">
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
              onClick={() => void sendCode()}
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
                  {OAUTH_PROVIDERS.map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      onClick={() => void social(p)}
                      disabled={busy}
                      isFullWidth
                    >
                      {oauth_continue({ provider: p }, { locale })}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-body-sm text-neutral">
              {login_code_sent({ email }, { locale })}
            </p>
            <label className="form-control">
              <span className="mb-2 block text-label text-neutral">
                {login_code_label({}, { locale })}
              </span>
              <input
                className={`otp ${error ? 'otp-error' : 'otp-primary'}`}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}
            <Button
              onClick={() => void verify()}
              disabled={otp.length !== 6 || busy}
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
            <Button
              variant="ghost"
              onClick={() => setStep('email')}
              disabled={busy}
              isFullWidth
            >
              {login_resend({}, { locale })}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onCancel} disabled={busy} isFullWidth>
          {gate_back({}, { locale })}
        </Button>
      </div>
    </div>
  );
};
