import { ChevronDown } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';

import type { ControlSize } from './useControlSize';
import { useCoveredHeight } from './useCoveredHeight';

type VenueResultsPanelProps = {
  label: string | null;
  isCollapsed: boolean;
  neighbour?: ControlSize | null;
  onToggle: () => void;
  onCoverChange: (height: number) => void;
  children: ReactNode;
};

const besideNeighbour = (neighbour: ControlSize): CSSProperties =>
  ({
    '--row-start': `calc(${neighbour.width}px + var(--spacing) * 5)`,
    '--row-height': `${neighbour.height}px`,
    '--row-top': `calc(var(--spacing) * 3 + (${neighbour.height}px - var(--spacing) * 11) / 2)`,
  }) as CSSProperties;

const placement = (isHint: boolean, isBeside: boolean): string => {
  if (isHint) {
    return 'max-lg:end-3 max-lg:mt-3 max-lg:w-fit max-lg:max-w-[calc(100%-var(--row-start)-var(--spacing)*3)]';
  }
  return isBeside
    ? 'max-lg:start-[var(--row-start)] max-lg:end-3 max-lg:mt-[var(--row-top)] max-lg:border max-lg:border-base-300 max-lg:bg-base-100'
    : 'max-lg:inset-x-3 max-lg:mt-3 max-lg:border max-lg:border-base-300 max-lg:bg-base-100';
};

export const VenueResultsPanel = ({
  label,
  isCollapsed,
  neighbour,
  onToggle,
  onCoverChange,
  children,
}: VenueResultsPanelProps) => {
  const labelId = useId();
  const bodyId = useId();
  const measure = useCoveredHeight(onCoverChange);
  const isHint = label === null;
  const isFolded = isCollapsed && !isHint;
  const isBeside = neighbour != null && (isHint || isFolded);

  return (
    <div
      ref={measure}
      style={isBeside ? besideNeighbour(neighbour) : undefined}
      className={`max-lg:absolute max-lg:top-full max-lg:z-30 max-lg:rounded-box max-lg:shadow-lg ${placement(
        isHint,
        isBeside,
      )}`}
    >
      {!isHint && (
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
        className={`flex flex-col gap-3 ${
          isHint
            ? 'max-lg:grid max-lg:min-h-[var(--row-height)]'
            : 'max-lg:max-h-48 max-lg:overflow-y-auto max-lg:px-3 max-lg:pb-3'
        } ${isFolded ? 'max-lg:hidden' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};
