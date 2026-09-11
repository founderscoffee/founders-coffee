import { useState } from 'react';

import { authClient } from '../../lib/auth';

type Step = 'email' | 'code';

export const AdminLogin = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: failed } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });
    setBusy(false);
    if (failed) {
      setError('That code could not be sent. Try again.');
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
      setError('That code was not accepted.');
      return;
    }
    window.location.assign('/');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">founders.coffee operations</h1>
        <p className="mt-1 text-sm opacity-70">
          Signed in behind Cloudflare Access. Use the address your operator
          account is registered with.
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
          <label className="text-sm" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            className="rounded border border-neutral-400 p-2"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className="rounded bg-neutral-900 p-2 text-white disabled:opacity-50"
            type="submit"
            disabled={busy || email.length === 0}
          >
            {busy ? 'Sending…' : 'Send code'}
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
          <label className="text-sm" htmlFor="admin-code">
            Code sent to {email}
          </label>
          <input
            id="admin-code"
            className="rounded border border-neutral-400 p-2 tracking-widest"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            className="rounded bg-neutral-900 p-2 text-white disabled:opacity-50"
            type="submit"
            disabled={busy || code.length === 0}
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button
            className="text-sm underline"
            type="button"
            onClick={() => setStep('email')}
          >
            Use a different address
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </main>
  );
};
