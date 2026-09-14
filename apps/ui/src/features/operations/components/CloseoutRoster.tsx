import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import {
  closeout_attended,
  closeout_no_show,
  type Locale,
} from '@founders-coffee/i18n';

import type { CloseoutView } from '../api';
import type { Mark } from '../draft';

type Member = CloseoutView['roster'][number];

export const ROSTER_VIRTUAL_THRESHOLD = 40;

const ROW_HEIGHT = 56;

const SCROLLER_HEIGHT = 384;

const MarkRow = ({
  member,
  mark,
  onMark,
  locale,
}: {
  member: Member;
  mark: Mark | undefined;
  onMark: (userId: string, outcome: Mark) => void;
  locale: Locale;
}) => (
  <>
    <span dir="auto">{member.name}</span>
    <span className="flex gap-2">
      {(['attended', 'no_show'] as const).map((outcome) => (
        <label className="flex items-center gap-1.5" key={outcome}>
          <input
            checked={mark === outcome}
            name={`mark-${member.userId}`}
            onChange={() => onMark(member.userId, outcome)}
            type="radio"
          />
          <span className="text-body-sm">
            {outcome === 'attended'
              ? closeout_attended({}, { locale })
              : closeout_no_show({}, { locale })}
          </span>
        </label>
      ))}
    </span>
  </>
);

const ROW_CLASS = 'flex flex-wrap items-center justify-between gap-3 py-3';

export const CloseoutRoster = ({
  locale,
  roster,
  marks,
  onMark,
}: {
  locale: Locale;
  roster: readonly Member[];
  marks: Readonly<Record<string, Mark>>;
  onMark: (userId: string, outcome: Mark) => void;
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const virtualised = roster.length > ROSTER_VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: roster.length,
    enabled: virtualised,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => scroller.current,
    initialRect: { width: 0, height: SCROLLER_HEIGHT },
    overscan: 8,
  });

  if (!virtualised)
    return (
      <ul className="mt-2 divide-y divide-base-200">
        {roster.map((member) => (
          <li className={ROW_CLASS} key={member.userId}>
            <MarkRow
              locale={locale}
              mark={marks[member.userId]}
              member={member}
              onMark={onMark}
            />
          </li>
        ))}
      </ul>
    );

  return (
    <div
      className="mt-2 overflow-y-auto"
      ref={scroller}
      style={{ maxHeight: `${SCROLLER_HEIGHT}px` }}
    >
      <ul
        className="relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const member = roster[row.index];
          return member ? (
            <li
              className={`${ROW_CLASS} absolute inset-x-0 top-0 border-b border-base-200`}
              key={member.userId}
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <MarkRow
                locale={locale}
                mark={marks[member.userId]}
                member={member}
                onMark={onMark}
              />
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
};
