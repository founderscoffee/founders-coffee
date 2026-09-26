import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { useCoveredHeight } from './useCoveredHeight';

type VenueResultsPanelProps = {
  label: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onCoverChange: (height: number) => void;
  children: ReactNode;
};

export const VenueResultsPanel = ({
  label,
  isCollapsed,
  onToggle,
  onCoverChange,
  children,
}: VenueResultsPanelProps) => {
  const labelId = useId();
  const bodyId = useId();
  const measure = useCoveredHeight(onCoverChange);
  const isFolded = isCollapsed && label !== null;

  return (
    <div
      ref={measure}
      className="max-lg:absolute max-lg:inset-x-3 max-lg:top-full max-lg:z-30 max-lg:mt-2 max-lg:rounded-box max-lg:border max-lg:border-base-300 max-lg:bg-base-100 max-lg:shadow-lg"
    >
      {label !== null && (
        <div className="relative flex items-center max-lg:min-h-11 max-lg:ps-3 max-lg:pe-12 lg:mb-1.5">
          <p id={labelId} className="text-caption text-neutral">
            {label}
          </p>
          <button
            type="button"
            onClick={onToggle}
            aria-labelledby={labelId}
            aria-expanded={!isFolded}
            aria-controls={bodyId}
            className="absolute inset-0 flex items-center justify-end rounded-box pe-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary lg:hidden"
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-5 text-neutral transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none ${
                isFolded ? '' : 'rotate-180'
              }`}
            />
          </button>
        </div>
      )}
      <div
        id={bodyId}
        className={`flex flex-col gap-3 max-lg:max-h-48 max-lg:overflow-y-auto max-lg:px-3 max-lg:pb-3 ${
          label === null ? 'max-lg:pt-3' : ''
        } ${isFolded ? 'max-lg:hidden' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};
