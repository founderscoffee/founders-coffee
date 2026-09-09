import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  profile_details_card_subtitle,
  profile_details_card_title,
  profile_discard,
  profile_intro_card_subtitle,
  profile_intro_card_title,
  profile_link_invalid,
  profile_name_invalid,
  profile_photo_card_subtitle,
  profile_photo_card_title,
  profile_reload,
  profile_retry,
  profile_save,
  profile_saved,
  profile_security_error,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { Turnstile } from '../../../components/auth/Turnstile';
import { usePublicAuthConfig } from '../../auth/hooks';
import type { PublicProfile, UserProfile } from '../api';
import { profileErrorMessage } from '../errors';
import { usePhotoUploadAvailability, useUpdateProfile } from '../hooks';
import {
  commandFrom,
  draftFrom,
  isDraftDirty,
  previewFrom,
  type ProfileDraft,
} from '../profile-draft';
import { ProfileDetailFields } from './ProfileDetailFields';
import { ProfileIntroFields } from './ProfileIntroFields';
import { ProfilePhotoField } from './ProfilePhotoField';
import { ProfilePublicPreview } from './ProfilePublicPreview';

const Card = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-box border border-base-300 bg-base-100 p-5 md:p-6">
    <h2 className="font-display text-h4">{title}</h2>
    <p className="mt-1 mb-5 text-body-sm text-neutral">{subtitle}</p>
    {children}
  </section>
);

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
  const lastPreview = useRef<PublicProfile | null>(null);
  const inFlight = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateProfile();
  const config = usePublicAuthConfig();
  const photos = usePhotoUploadAvailability();

  const isDirty = isDraftDirty(draft, base);
  const canVerify = !!token || config.data?.isTurnstileBypassed === true;
  const preview = previewFrom(draft, base, locale) ?? lastPreview.current;
  if (preview) lastPreview.current = preview;

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
      visibility: {
        ...current.visibility,
        photo: photoAssetId === null ? false : current.visibility.photo,
      },
    });
    setBase(patch);
    setDraft(patch);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !canVerify) return;
    const built = commandFrom(draft, base.revision, locale);
    if (!built.ok) {
      setInvalidField(built.field);
      setError(
        built.field === 'professionalLink'
          ? profile_link_invalid({}, { locale })
          : profile_name_invalid({}, { locale }),
      );
      if (built.field === 'displayName') nameRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setError(null);
    setInvalidField(null);
    try {
      adopt(
        await mutation.mutateAsync({
          profile: built.command,
          turnstileToken: token ?? undefined,
        }),
      );
    } catch (failure) {
      setError(profileErrorMessage(failure, locale));
    } finally {
      inFlight.current = false;
      setToken(null);
      setNonce((value) => value + 1);
    }
  };

  const reload = async () => {
    const fresh = await onReload();
    if (!fresh) return;
    adopt(fresh);
    setError(null);
    setInvalidField(null);
    mutation.reset();
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="grid gap-6 lg:grid-cols-[1fr_17rem] lg:items-start"
    >
      <div className="space-y-6">
        {photos.data?.enabled === true && (
          <Card
            title={profile_photo_card_title({}, { locale })}
            subtitle={profile_photo_card_subtitle({}, { locale })}
          >
            <ProfilePhotoField
              locale={locale}
              displayName={draft.displayName}
              photoAssetId={draft.photoAssetId}
              isPublic={draft.visibility.photo}
              isDisabled={mutation.isPending}
              turnstileToken={token ?? undefined}
              onPhotoChange={applyPhoto}
              onPublishChange={(photo) =>
                change({ visibility: { ...draft.visibility, photo } })
              }
            />
          </Card>
        )}

        <Card
          title={profile_intro_card_title({}, { locale })}
          subtitle={profile_intro_card_subtitle({}, { locale })}
        >
          <ProfileIntroFields
            locale={locale}
            draft={draft}
            isDisabled={mutation.isPending}
            nameRef={nameRef}
            hasNameError={invalidField === 'displayName'}
            onChange={change}
          />
        </Card>

        <Card
          title={profile_details_card_title({}, { locale })}
          subtitle={profile_details_card_subtitle({}, { locale })}
        >
          <ProfileDetailFields
            locale={locale}
            draft={draft}
            isDisabled={mutation.isPending}
            onChange={change}
          />
        </Card>

        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}

        {!config.data?.isTurnstileBypassed && config.data?.turnstileSiteKey && (
          <Turnstile
            sitekey={config.data.turnstileSiteKey}
            action="update_profile"
            resetKey={nonce}
            onToken={setToken}
          />
        )}
        {(config.isError ||
          (config.data &&
            !config.data.isTurnstileBypassed &&
            !config.data.turnstileSiteKey)) && (
          <div role="alert">
            <p>{profile_security_error({}, { locale })}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void config.refetch()}
            >
              {profile_retry({}, { locale })}
            </Button>
          </div>
        )}

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
        {mutation.isSuccess && !error && !isDirty && (
          <p role="status">{profile_saved({}, { locale })}</p>
        )}
      </div>

      {preview && (
        <ProfilePublicPreview
          locale={locale}
          preview={preview}
          isDirty={isDirty}
        />
      )}
    </form>
  );
};
