import { Crosshair } from 'lucide-react';

import { host_locate_me, type Locale } from '@founders-coffee/i18n';

import { HostMapButton } from './HostMapButton';
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
      <HostMapButton
        ref={measure}
        icon={Crosshair}
        label={host_locate_me({}, { locale })}
        onClick={onClick}
      />
    </div>
  );
};
