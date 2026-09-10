import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  profile_discard,
  profile_link_invalid,
  profile_name_invalid,
  profile_photo_card_subtitle,
  profile_reload,
  profile_save,
  profile_saved,
  profile_load_error,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, useToast } from '@founders-coffee/ui';

import { Turnstile } from '../../../components/auth/Turnstile';
import { usePublicAuthConfig } from '../../auth/hooks';
import type { UserProfile } from '../api';
import { profileErrorMessage } from '../errors';
import { usePhotoUploadAvailability, useUpdateProfile } from '../hooks';
import {
  commandFrom,
  draftFrom,
  isDraftDirty,
  type ProfileDraft,
} from '../profile-draft';
import { ProfileDetailFields } from './ProfileDetailFields';
import { ProfileIntroFields } from './ProfileIntroFields';
import { ProfilePhotoField } from './ProfilePhotoField';
import { ProfileFeedback } from './ProfileFeedback';

export const ProfileForm = ({
  profile: saved,
  locale,
  onDirtyChange,
  onReload,
}: {
  profile: UserProfile;
  locale: Locale;
  onDirtyChange?: (isDirty: boolean) => void;
  onReload: () => Promise<UserProfile | undefined>;
}) => {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(saved));
  const [base, setBase] = useState<UserProfile>(saved);
  const [token, setToken] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const inFlight = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateProfile();
  const config = usePublicAuthConfig();
  const photos = usePhotoUploadAvailability();
  const feedback = useToast();
  const reportError = (message: string) => {
    setError(message);
    feedback.show(message, 'error');
  };

  const isDirty = isDraftDirty(draft, base);
  const canVerify = !!token || config.data?.isTurnstileBypassed === true;

  const reportDirty = useRef(onDirtyChange);
  reportDirty.current = onDirtyChange;
  useEffect(() => {
    reportDirty.current?.(isDirty);
    return () => reportDirty.current?.(false);
  }, [isDirty]);

  const change = (patch: Partial<ProfileDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const adopt = (next: UserProfile) => {
    setBase(next);
    setDraft(draftFrom(next));
  };

  const applyPhoto = (photoAssetId: string | null) => {
    const patch = <T extends ProfileDraft>(current: T): T => ({
      ...current,
      photoAssetId,
    });
    setBase(patch);
    setDraft(patch);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !canVerify) return;
    const built = commandFrom(draft, base.revision);
    if (!built.ok) {
      setInvalidField(built.field);
      reportError(
        built.field === 'professionalLink'
          ? profile_link_invalid({}, { locale })
          : profile_name_invalid({}, { locale }),
      );
      if (built.field === 'displayName') nameRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setError(null);
    feedback.clear();
    setInvalidField(null);
    try {
      adopt(
        await mutation.mutateAsync({
          profile: built.command,
          turnstileToken: token ?? undefined,
        }),
      );
      feedback.show(profile_saved({}, { locale }), 'success');
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
      adopt(fresh);
      setError(null);
      setInvalidField(null);
      feedback.clear();
      mutation.reset();
    } catch {
      reportError(profile_load_error({}, { locale }));
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      <div className="space-y-6">
        <section className="space-y-6 bg-base-100 p-5 md:p-6">
          {photos.data?.enabled === true && (
            <div className="mb-6">
              <p className="mb-5 text-body-sm text-neutral">
                {profile_photo_card_subtitle({}, { locale })}
              </p>
              <ProfilePhotoField
                locale={locale}
                displayName={draft.displayName}
                photoAssetId={draft.photoAssetId}
                isDisabled={mutation.isPending}
                turnstileToken={token ?? undefined}
                onPhotoChange={applyPhoto}
                onFeedback={feedback.show}
              />
            </div>
          )}
          <ProfileIntroFields
            locale={locale}
            draft={draft}
            isDisabled={mutation.isPending}
            nameRef={nameRef}
            hasNameError={invalidField === 'displayName'}
            onChange={change}
          />
          <ProfileDetailFields
            locale={locale}
            draft={draft}
            isDisabled={mutation.isPending}
            onChange={change}
          />
        </section>

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
              onClick={() => adopt(base)}
            >
              {profile_discard({}, { locale })}
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
      </div>
    </form>
  );
};
