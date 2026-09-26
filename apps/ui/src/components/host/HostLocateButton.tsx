import { Crosshair } from 'lucide-react';

import { host_locate_me, type Locale } from '@founders-coffee/i18n';

type HostLocateButtonProps = {
  locale: Locale;
  covered: number;
  onClick: () => void;
};

export const HostLocateButton = ({
  locale,
  covered,
  onClick,
}: HostLocateButtonProps) => (
  <div
    className="absolute start-3 top-3 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none"
    style={{ transform: `translateY(${covered}px)` }}
  >
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-full border border-base-300 bg-base-100 px-4 text-body-sm font-medium text-base-content shadow-lg backdrop-blur-md transition hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-secondary motion-reduce:transition-none"
    >
      <Crosshair className="size-4 shrink-0" aria-hidden="true" />
      {host_locate_me({}, { locale })}
    </button>
  </div>
);
