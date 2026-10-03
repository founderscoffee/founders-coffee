import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import type { ControlSize } from './useControlSize';
import { useCoveredHeight } from './useCoveredHeight';

type VenueResultsPanelProps = {
  label: string | null;
  row?: ControlSize | null;
  search?: ReactNode;
  choice?: ReactNode;
  after?: ReactNode;
  isListHiddenBelowLg: boolean;
  isHiddenBelowLg: boolean;
  onCoverChange: (height: number) => void;
  children: ReactNode;
};

const belowRow = (row: ControlSize): CSSProperties =>
  ({ '--row-height': `${row.height}px` }) as CSSProperties;

const SURFACE =
  'max-lg:rounded-box max-lg:border max-lg:border-base-300 max-lg:bg-base-100 max-lg:shadow-lg';

const isFocusHiddenIn = (container: HTMLElement | null): boolean => {
  const active = document.activeElement;
  return (
    active instanceof HTMLElement &&
    container?.contains(active) === true &&
    active.getClientRects().length === 0
  );
};

export const VenueResultsPanel = ({
  label,
  row,
  search,
  choice,
  after,
  isListHiddenBelowLg,
  isHiddenBelowLg,
  onCoverChange,
  children,
}: VenueResultsPanelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const choiceRef = useRef<HTMLDivElement>(null);
  const measure = useCoveredHeight(onCoverChange);
  const isBare = !search && label === null && !choice && !after;

  useEffect(() => {
    if (isListHiddenBelowLg && isFocusHiddenIn(listRef.current)) {
      choiceRef.current?.focus();
    }
  }, [isListHiddenBelowLg]);

  return (
    <div
      ref={measure}
      style={row ? belowRow(row) : undefined}
      className={`max-lg:absolute max-lg:inset-x-3 max-lg:top-full max-lg:z-30 max-lg:mt-[calc(var(--row-height,2rem)+var(--spacing)*5)] ${
        isBare ? '' : SURFACE
      } ${isHiddenBelowLg ? 'max-lg:hidden' : ''}`}
    >
      {search && (
        <div className="max-lg:px-3 max-lg:pt-3 lg:mb-3">{search}</div>
      )}
      <div
        ref={listRef}
        className={isListHiddenBelowLg ? 'max-lg:hidden' : undefined}
      >
        {label && (
          <p className="text-caption text-neutral max-lg:px-3 max-lg:pt-3 lg:mb-1.5">
            {label}
          </p>
        )}
        <div
          className={`flex flex-col gap-3 ${
            isBare ? '' : 'max-lg:max-h-48 max-lg:overflow-y-auto max-lg:p-3'
          }`}
        >
          {children}
        </div>
      </div>
      {(choice || after) && (
        <div
          className={`flex flex-col gap-3 max-lg:p-3 ${after ? 'lg:mt-3' : ''}`}
        >
          {choice && (
            <div
              ref={choiceRef}
              tabIndex={-1}
              className="outline-none lg:hidden"
            >
              {choice}
            </div>
          )}
          {after}
        </div>
      )}
    </div>
  );
};
