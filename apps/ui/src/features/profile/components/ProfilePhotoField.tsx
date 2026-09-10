import { useRef } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  profile_photo_alt,
  profile_photo_choose,
  profile_photo_remove,
  profile_photo_replace,
  profile_photo_saved,
  profile_photo_removed,
  profile_photo_uploading,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, type ToastMessage } from '@founders-coffee/ui';

import { initials } from '../../../lib/utils';
import { photoErrorMessage } from '../errors';
import { usePhotoUpload, useRemovePhoto } from '../hooks';
import { profilePhotoUrl } from '../photo-url';

const ACCEPT = 'image/jpeg,image/png,image/webp';

export const ProfilePhotoField = ({
  locale,
  displayName,
  photoAssetId,
  isDisabled,
  turnstileToken,
  onPhotoChange,
  onFeedback,
}: {
  locale: Locale;
  displayName: string;
  photoAssetId: string | null;
  isDisabled?: boolean;
  turnstileToken?: string;
  onPhotoChange: (assetId: string | null) => void;
  onFeedback: (message: string, variant: ToastMessage['variant']) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const upload = usePhotoUpload();
  const remove = useRemovePhoto();
  const busy = upload.isPending || remove.isPending || isDisabled === true;

  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      onPhotoChange(await upload.mutateAsync({ file, turnstileToken }));
      onFeedback(profile_photo_saved({}, { locale }), 'success');
    } catch (failure) {
      onFeedback(photoErrorMessage(appErrorCode(failure), locale), 'error');
    }
  };

  const discard = async () => {
    try {
      await remove.mutateAsync(turnstileToken);
      onPhotoChange(null);
      onFeedback(profile_photo_removed({}, { locale }), 'success');
    } catch (failure) {
      onFeedback(photoErrorMessage(appErrorCode(failure), locale), 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="avatar avatar-placeholder">
          <div className="w-20 rounded-full bg-neutral text-neutral-content">
            {photoAssetId ? (
              <img
                src={profilePhotoUrl(photoAssetId, 'md')}
                alt={profile_photo_alt({}, { locale })}
                width={80}
                height={80}
                className="rounded-full object-cover"
              />
            ) : (
              <span className="text-h3" aria-hidden="true">
                {initials(displayName)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {photoAssetId
              ? profile_photo_replace({}, { locale })
              : profile_photo_choose({}, { locale })}
          </Button>
          {photoAssetId && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void discard()}
            >
              {profile_photo_remove({}, { locale })}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={profile_photo_choose({}, { locale })}
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {upload.isPending && (
        <p role="status" className="mt-2 text-body-sm text-neutral">
          {profile_photo_uploading({}, { locale })}
        </p>
      )}
    </div>
  );
};
