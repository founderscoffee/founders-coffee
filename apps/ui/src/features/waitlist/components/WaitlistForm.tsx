import { appErrorCode } from '@founders-coffee/core';
import {
  hero_waitlist_already,
  hero_waitlist_error,
  hero_waitlist_invalid_email,
  hero_waitlist_placeholder,
  hero_waitlist_submit,
  hero_waitlist_submitting,
  hero_waitlist_success,
  type Locale,
} from '@founders-coffee/i18n';
import { useState } from 'react';
import { Turnstile } from '@founders-coffee/ui';

import { LegalNotice } from '../../../components/company/LegalNotice';
import { usePublicAuthConfig } from '../../auth/hooks';
import { useJoinWaitlist } from '../hooks';

type WaitlistFormProps = {
  locale: Locale;
  marketCode: string;
  cityCode: string;
  cityName: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WaitlistForm = ({
  locale,
  marketCode,
  cityCode,
  cityName,
}: WaitlistFormProps) => {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const joinWaitlist = useJoinWaitlist();
  const authConfig = usePublicAuthConfig();
  const sitekey = authConfig.data?.turnstileSiteKey ?? null;
  const isBypassed = authConfig.data?.isTurnstileBypassed === true;
  const isVerified = isBypassed || turnstileToken !== null;

  const validate = (value: string): boolean => {
    if (!EMAIL_RE.test(value)) {
      setLocalError(hero_waitlist_invalid_email({}, { locale }));
      return false;
    }
    setLocalError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!validate(trimmed)) return;
    if (!isVerified) return;

    try {
      const result = (await joinWaitlist.mutateAsync({
        data: {
          email: trimmed,
          marketCode,
          cityCode,
          locale,
          turnstileToken: turnstileToken ?? undefined,
        },
      })) as { status: 'joined' | 'already_waitlisted' };
      if (result?.status === 'already_waitlisted') {
        setLocalError(hero_waitlist_already({ city: cityName }, { locale }));
      }
    } catch (error) {
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      if (appErrorCode(error) === 'validation_failed') {
        setLocalError(hero_waitlist_invalid_email({}, { locale }));
      } else {
        setLocalError(hero_waitlist_error({}, { locale }));
      }
    }
  };

  if (joinWaitlist.isSuccess && !localError) {
    return (
      <p className="mt-3 text-center text-sm text-success">
        ✓ {hero_waitlist_success({ city: cityName }, { locale })}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (localError) setLocalError(null);
          }}
          placeholder={hero_waitlist_placeholder({}, { locale })}
          aria-label={hero_waitlist_placeholder({}, { locale })}
          aria-invalid={!!localError}
          className="input input-bordered h-10 flex-1 text-sm"
          disabled={joinWaitlist.isPending}
          required
        />
        <button
          type="submit"
          className="btn btn-outline btn-sm h-10"
          disabled={joinWaitlist.isPending || !isVerified}
        >
          {joinWaitlist.isPending
            ? hero_waitlist_submitting({}, { locale })
            : hero_waitlist_submit({}, { locale })}
        </button>
      </form>
      {sitekey && !isBypassed && (
        <Turnstile
          sitekey={sitekey}
          action="join_waitlist"
          appearance="interaction-only"
          language={locale}
          resetKey={turnstileResetKey}
          onToken={setTurnstileToken}
        />
      )}
      {localError && (
        <p className="text-xs text-error" role="alert">
          {localError}
        </p>
      )}
      <LegalNotice locale={locale} className="text-start sm:text-center" />
    </div>
  );
};
