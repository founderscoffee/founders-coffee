import type { ReactNode } from 'react';

export const AccountRow = ({
  label,
  value,
  note,
  status,
}: {
  label: ReactNode;
  value?: ReactNode;
  note?: string;
  status?: ReactNode;
}) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-base-200 py-3 last:border-b-0">
    <div className="min-w-0">
      <p className="text-body-sm font-medium">{label}</p>
      {note && <p className="mt-0.5 text-caption text-neutral">{note}</p>}
    </div>
    <div className="flex min-w-0 items-baseline gap-2">
      {value !== undefined && (
        <span className="text-body-sm break-all" dir="auto">
          {value}
        </span>
      )}
      {status}
    </div>
  </div>
);
