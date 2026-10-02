import { profilePhotoUrl } from '../../features/profile/photo-url';
import { firstCharacter } from '../../lib/utils';

type HostFaceProps = {
  name: string;
  photoAssetId: string | null;
};

export const HostFace = ({ name, photoAssetId }: HostFaceProps) => (
  <span className="avatar avatar-placeholder size-8 shrink-0 border-2 border-base-100">
    <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-base-200 text-caption font-semibold text-base-content">
      {photoAssetId ? (
        <img
          src={profilePhotoUrl(photoAssetId, 'sm')}
          alt=""
          width="28"
          height="28"
          loading="lazy"
          decoding="async"
          className="size-full rounded-full object-cover"
        />
      ) : (
        firstCharacter(name)
      )}
    </span>
  </span>
);
