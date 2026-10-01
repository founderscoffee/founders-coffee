import type { LucideIcon } from 'lucide-react';
import type { Ref } from 'react';

type HostMapButtonProps = {
  icon: LucideIcon;
  label: string;
  ref?: Ref<HTMLButtonElement>;
  onClick: () => void;
};

export const HostMapButton = ({
  icon: Icon,
  label,
  ref,
  onClick,
}: HostMapButtonProps) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="btn btn-xs sm:btn-sm md:btn-md gap-2 rounded-full border-base-300 bg-base-100 font-medium text-base-content shadow-lg backdrop-blur-md hover:bg-base-200"
  >
    <Icon className="size-4 shrink-0" aria-hidden="true" />
    {label}
  </button>
);
