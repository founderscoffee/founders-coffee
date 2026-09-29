import { Crosshair } from 'lucide-react';

import { host_locate_me, type Locale } from '@founders-coffee/i18n';

import { useControlSize, type ControlSize } from './useControlSize';

type HostLocateButtonProps = {
  locale: Locale;
  onResize?: (size: ControlSize | null) => void;
  onClick: () => void;
};

export const HostLocateButton = ({
  locale,
  onResize,
  onClick,
}: HostLocateButtonProps) => {
  const measure = useControlSize(onResize);

  return (
    <div className="absolute start-3 top-3 flex has-[:focus-visible]:z-40">
      <button
        ref={measure}
        type="button"
        onClick={onClick}
        className="btn btn-xs sm:btn-sm md:btn-md lg:btn-lg gap-2 rounded-full border-base-300 bg-base-100 font-medium text-base-content shadow-lg backdrop-blur-md hover:bg-base-200"
      >
        <Crosshair className="size-4 shrink-0" aria-hidden="true" />
        {host_locate_me({}, { locale })}
      </button>
    </div>
  );
};
