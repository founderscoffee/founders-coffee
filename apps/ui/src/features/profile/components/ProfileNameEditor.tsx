import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  profile_name_label,
  profile_name_hint,
  profile_name_invalid,
  profile_saved,
  profile_save,
  profile_cancel,
  profile_reload,
  profile_load_error,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, Input, useToast } from '@founders-coffee/ui';

import { Turnstile } from '../../../components/auth/Turnstile';
import { usePublicAuthConfig } from '../../auth/hooks';
import type { UserProfile } from '../api';
import { profileErrorMessage } from '../errors';
import { useUpdateDisplayName } from '../hooks';
import { validateProfileName } from '../name-validation';
import { ProfileFeedback } from './ProfileFeedback';

export const ProfileNameEditor = ({
  profile,
  locale,
  onSaved,
  onReload,
  onDirtyChange,
}: {
  profile: UserProfile;
  locale: Locale;
  onSaved?: () => void;
  onReload: () => Promise<UserProfile | undefined>;
  onDirtyChange?: (isDirty: boolean) => void;
}) => {
  const [name, setName] = useState(profile.displayName);
  const [revision, setRevision] = useState(profile.revision);
  const [token, setToken] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateDisplayName();
  const config = usePublicAuthConfig();
  const feedback = useToast();
  const reportError = (message: string) => {
    setError(message);
    feedback.show(message, 'error');
  };
  const [saved, setSaved] = useState(profile.displayName);
  const isDirty = name.trim() !== saved.trim() && !mutation.isPending;
  const reportDirty = useRef(onDirtyChange);
  reportDirty.current = onDirtyChange;
  useEffect(() => {
    reportDirty.current?.(isDirty);
    return () => reportDirty.current?.(false);
  }, [isDirty]);
  const canVerify = !!token || config.data?.isTurnstileBypassed === true;
  const revert = () => {
    setName(saved);
    setError(null);
    feedback.clear();
    inputRef.current?.focus();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !canVerify) return;
    const parsed = validateProfileName(name);
    if (!parsed.success) {
      reportError(profile_name_invalid({}, { locale }));
      inputRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setError(null);
    feedback.clear();
    try {
      const result = await mutation.mutateAsync({
        displayName: parsed.data,
        expectedRevision: revision,
        turnstileToken: token ?? undefined,
      });
      setName(result.displayName);
      setSaved(result.displayName);
      setRevision(result.revision);
      feedback.show(profile_saved({}, { locale }), 'success');
      onSaved?.();
    } catch (failure) {
      reportError(profileErrorMessage(failure, locale));
    } finally {
      inFlight.current = false;
      setToken(null);
      setNonce((value) => value + 1);
    }
  };
  const reload = async () => {
    try {
      const fresh = await onReload();
      if (!fresh) {
        reportError(profile_load_error({}, { locale }));
        return;
      }
      setName(fresh.displayName);
      setSaved(fresh.displayName);
      setRevision(fresh.revision);
      setError(null);
      feedback.clear();
      mutation.reset();
    } catch {
      reportError(profile_load_error({}, { locale }));
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <label className="form-control block">
        <span className="mb-2 block text-label">
          {profile_name_label({}, { locale })}
        </span>
        <Input
          ref={inputRef}
          name="displayName"
          autoComplete="nickname"
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={!!error}
          aria-describedby="profile-name-help"
          disabled={mutation.isPending}
        />
      </label>
      <p id="profile-name-help" className="text-body-sm text-neutral">
        {profile_name_hint({}, { locale })}
      </p>
      {!config.data?.isTurnstileBypassed && config.data?.turnstileSiteKey && (
        <Turnstile
          sitekey={config.data.turnstileSiteKey}
          action="update_profile"
          resetKey={nonce}
          onToken={setToken}
        />
      )}
      <ProfileFeedback
        locale={locale}
        notification={feedback.notification}
        onDismiss={feedback.clear}
        hasSecurityError={
          config.isError ||
          (!!config.data &&
            !config.data.isTurnstileBypassed &&
            !config.data.turnstileSiteKey)
        }
        onRetry={() => void config.refetch()}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canVerify || mutation.isPending}>
          {profile_save({}, { locale })}
        </Button>
        {isDirty && (
          <Button
            type="button"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={revert}
          >
            {profile_cancel({}, { locale })}
          </Button>
        )}
        {error && (
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => void reload()}
          >
            {profile_reload({}, { locale })}
          </Button>
        )}
      </div>
    </form>
  );
};
