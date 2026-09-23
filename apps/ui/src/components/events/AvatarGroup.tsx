import { HostFace } from './HostFace';

const COUNT_CAP = 99;

type Face = {
  readonly name: string;
  readonly photoAssetId: string | null;
};

type AvatarGroupProps = {
  faces: readonly Face[];
  more: number;
  label: string;
};

export const AvatarGroup = ({ faces, more, label }: AvatarGroupProps) => (
  <span
    role="img"
    aria-label={label}
    className="avatar-group -space-x-3 shrink-0 overflow-visible"
  >
    {faces.map((face, index) => (
      <HostFace
        key={`face-${index}`}
        name={face.name}
        photoAssetId={face.photoAssetId}
      />
    ))}
    {more > 0 ? (
      <span className="avatar avatar-placeholder size-8 shrink-0 border-2 border-base-100">
        <span
          dir="ltr"
          className="flex size-full items-center justify-center rounded-full bg-base-200 text-caption font-semibold text-base-content"
        >
          +{Math.min(more, COUNT_CAP)}
        </span>
      </span>
    ) : null}
  </span>
);
