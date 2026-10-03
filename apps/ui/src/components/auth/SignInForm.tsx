import { useRef, useState, type FormEvent, type ReactNode } from 'react';

import {
  gate_back,
  login_account_note,
  login_change_email,
  login_code_sent,
  login_send_error,
  login_verify,
  rate_limited,
  type Locale,
  code_error,
} from '@founders-coffee/i18n';
import { Button, StatusMessage, Turnstile } from '@founders-coffee/ui';

import { LegalNotice } from '../company/LegalNotice';
import { authClient } from '../../lib/auth';
import { LoginEmailField } from './LoginEmailField';
import { OtpField, OTP_LENGTH } from './OtpField';
import { BackArrow } from './ProviderIcon';
import { ResendButton } from './ResendButton';
import { SocialSignIn, type SocialProvider } from './SocialSignIn';
import { useOtpAutofill } from './useOtpAutofill';
import { useResendCooldown } from './useResendCooldown';
import { useStepHeightLock } from './useStepHeightLock';
import { useRevealOnMount } from './useRevealOnMount';

const TOO_MANY_REQUESTS = 429;

const sendErrorMessage = (status: number, locale: Locale): string =>
  (status === TOO_MANY_REQUESTS ? rate_limited : login_send_error)(
    {},
    { locale },
  );

type SocialRedirect = {
  callbackURL: string;
  newUserCallbackURL?: string;
};

export type SignInFormProps = {
  locale: Locale;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
  socialProviders: readonly SocialProvider[];
  layout: 'page' | 'gate';
  title: ReactNode;
  emailActionLabel: string;
  getSocialRedirect: () => SocialRedirect;
  onAuthenticated: () => void;
  onCancel?: () => void;
};

export const SignInForm = ({
  locale,
  turnstileSiteKey,
  isTurnstileBypassed,
  socialProviders,
  layout,
  title,
  emailActionLabel,
  getSocialRedirect,
  onAuthenticated,
  onCancel,
}: SignInFormProps) => {
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

  const isPage = layout === 'page';
  const emailValid = /.+@.+\..+/.test(email);
  const turnstileEnabled = Boolean(turnstileSiteKey) && !isTurnstileBypassed;
  const canResend = isTurnstileBypassed || resendToken !== null;

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
      setError(sendErrorMessage(sendError.status, locale));
      return;
    }
    stepHeight.lock();
    setStep('otp');
    cooldown.start();
  };

  const resend = async () => {
    if (!cooldown.isReady || !canResend) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: 'sign-in' },
      { headers: { 'x-captcha-response': resendToken } },
    );
    setBusy(false);
    if (sendError) {
      setError(sendErrorMessage(sendError.status, locale));
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
    onAuthenticated();
  };

  const changeEmail = () => {
    setOtp('');
    setError(null);
    setResendToken(null);
    stepHeight.release();
    setStep('email');
  };

  const social = (provider: SocialProvider) => {
    const { callbackURL, newUserCallbackURL } = getSocialRedirect();
    return authClient.signIn.social({
      provider,
      callbackURL,
      ...(newUserCallbackURL ? { newUserCallbackURL } : {}),
    });
  };

  const submitStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (step === 'email' ? sendCode() : verify());
  };

  useOtpAutofill(step === 'otp', setOtp);
  useRevealOnMount(rootRef);

  const form = (
    <form
      ref={stepHeight.ref}
      style={{ minHeight: stepHeight.minHeight }}
      className={
        isPage ? 'flex flex-col gap-4' : 'mt-5 flex max-w-sm flex-col gap-4'
      }
      onSubmit={submitStep}
    >
      {isPage && (
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-h3 font-semibold">{title}</h1>
        </div>
      )}

      {step === 'email' ? (
        <>
          <LoginEmailField
            locale={locale}
            value={email}
            hasHelp={isPage}
            onChange={setEmail}
          />
          {turnstileEnabled && (
            <Turnstile
              sitekey={turnstileSiteKey ?? ''}
              language={locale}
              onToken={setToken}
            />
          )}
          {error && <StatusMessage variant="error">{error}</StatusMessage>}
          <Button
            type="submit"
            disabled={!emailValid || (!isTurnstileBypassed && !token) || busy}
            isFullWidth
          >
            {busy ? (
              <span
                className="loading loading-spinner loading-xs"
                aria-hidden="true"
              />
            ) : null}
            {emailActionLabel}
          </Button>
          <LegalNotice
            locale={locale}
            className={isPage ? 'mt-1' : undefined}
          />
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
          {turnstileEnabled && (
            <Turnstile
              sitekey={turnstileSiteKey ?? ''}
              appearance="interaction-only"
              language={locale}
              resetKey={resendNonce}
              onToken={setResendToken}
            />
          )}
          <ResendButton
            locale={locale}
            secondsLeft={cooldown.secondsLeft}
            isBusy={busy || !canResend}
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
      {onCancel && (
        <Button variant="ghost" onClick={onCancel} disabled={busy} isFullWidth>
          <BackArrow locale={locale} />
          {gate_back({}, { locale })}
        </Button>
      )}
    </form>
  );

  return isPage ? (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-12">
      <div>{form}</div>
    </div>
  ) : (
    <div
      ref={rootRef}
      className="mt-6 rounded-box border border-base-300 bg-base-200 p-5 md:p-6"
    >
      <h3 className="font-display text-h4 font-semibold text-base-content">
        {title}
      </h3>
      {form}
    </div>
  );
};
