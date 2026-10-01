import { ChevronDown } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

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
  }) as CSSProperties;

const SURFACE =
  'max-lg:rounded-box max-lg:border max-lg:border-base-300 max-lg:bg-base-100 max-lg:shadow-lg';

const placement = (isHeaderless: boolean, isBeside: boolean): string => {
  if (isHeaderless) {
    return 'max-lg:end-3 max-lg:mt-3 max-lg:w-fit max-lg:max-w-[calc(100%-var(--row-start)-var(--spacing)*3)]';
  }
  return isBeside
    ? `${SURFACE} max-lg:start-[var(--row-start)] max-lg:end-3 max-lg:mt-3 max-lg:h-[var(--row-height)]`
    : `${SURFACE} max-lg:inset-x-3 max-lg:mt-3`;
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const measure = useCoveredHeight(onCoverChange);
  const isHeaderless = label === null;
  const isFolded = isCollapsed && !isHeaderless;
  const isBeside = neighbour != null && (isHeaderless || isFolded);

  useEffect(() => {
    if (isFolded && bodyRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
  }, [isFolded]);

  return (
    <div
      ref={measure}
      style={isBeside ? besideNeighbour(neighbour) : undefined}
      className={`max-lg:absolute max-lg:top-full max-lg:z-30 ${placement(
        isHeaderless,
        isBeside,
      )}`}
    >
      {!isHeaderless && (
        <div
          className={`grid lg:mb-1.5 ${isBeside ? 'max-lg:h-full' : 'max-lg:min-h-11'}`}
        >
          <p
            id={labelId}
            className="col-start-1 row-start-1 self-center text-caption text-neutral max-lg:ps-3 max-lg:pe-12"
          >
            {label}
          </p>
          <button
            ref={toggleRef}
            type="button"
            onClick={onToggle}
            aria-labelledby={labelId}
            aria-expanded={!isFolded}
            aria-controls={bodyId}
            className="tap-target col-start-1 row-start-1 flex items-center justify-end rounded-box pe-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary lg:hidden"
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-4 text-neutral transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none ${
                isFolded ? '' : 'rotate-180'
              }`}
            />
          </button>
        </div>
      )}
      <div
        ref={bodyRef}
        id={bodyId}
        className={`flex flex-col gap-3 ${
          isHeaderless
            ? 'max-lg:grid max-lg:min-h-[var(--row-height)]'
            : 'max-lg:max-h-48 max-lg:overflow-y-auto max-lg:px-3 max-lg:pb-3'
        } ${isFolded ? 'max-lg:hidden' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};
