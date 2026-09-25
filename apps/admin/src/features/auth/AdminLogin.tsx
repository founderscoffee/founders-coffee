import { useState } from 'react';

import {
  captcha_wait,
  checking,
  code_error,
  code_label,
  email_label,
  send_code,
  send_error,
  sending,
  sign_in,
  sign_in_note,
  title,
  use_other_email,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage, Turnstile } from '@founders-coffee/ui';

import { authClient } from '../../lib/auth';
import { LocaleToggle } from '../shell/LocaleToggle';

type Step = 'email' | 'code';

export const AdminLogin = ({
  locale,
  turnstileSiteKey,
}: {
  locale: Locale;
  turnstileSiteKey: string;
}) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsToken = turnstileSiteKey.length > 0;
  const canSend = email.length > 0 && (!needsToken || !!token);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: failed } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: 'sign-in' },
      token ? { headers: { 'x-captcha-response': token } } : {},
    );
    setBusy(false);
    if (failed) {
      setError(send_error({}, { locale }));
      return;
    }
    setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: failed } = await authClient.signIn.emailOtp({
      email,
      otp: code,
    });
    setBusy(false);
    if (failed) {
      setError(code_error({}, { locale }));
      return;
    }
    window.location.assign('/');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <div>
        <div className="mb-3 flex justify-end">
          <LocaleToggle active={locale} />
        </div>
        <h1 className="font-display text-h4">{title({}, { locale })}</h1>
        <p className="mt-1 text-body-sm text-neutral">
          {sign_in_note({}, { locale })}
        </p>
      </div>

      {step === 'email' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="text-body-sm" htmlFor="admin-email">
            {email_label({}, { locale })}
          </label>
          <input
            className="rounded-box border border-base-300 p-2"
            id="admin-email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {needsToken && (
            <Turnstile
              sitekey={turnstileSiteKey}
              language={locale}
              onToken={setToken}
            />
          )}
          {needsToken && !token && (
            <LoadingStatus
              label={captcha_wait({}, { locale })}
              className="text-caption"
            />
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !canSend}
          >
            {busy ? sending({}, { locale }) : send_code({}, { locale })}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <label className="text-body-sm" htmlFor="admin-code">
            {code_label({ email }, { locale })}
          </label>
          <input
            className="rounded-box border border-base-300 p-2 tracking-widest"
            id="admin-code"
            inputMode="numeric"
            dir="ltr"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || code.length === 0}
          >
            {busy ? checking({}, { locale }) : sign_in({}, { locale })}
          </button>
          <button
            className="text-body-sm underline"
            type="button"
            onClick={() => setStep('email')}
          >
            {use_other_email({}, { locale })}
          </button>
        </form>
      )}

      {error && <StatusMessage variant="error">{error}</StatusMessage>}
    </main>
  );
};
