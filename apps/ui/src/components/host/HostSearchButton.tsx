import { Search } from 'lucide-react';

import { host_search_venues, type Locale } from '@founders-coffee/i18n';

import { HostMapButton } from './HostMapButton';

type HostSearchButtonProps = {
  locale: Locale;
  onClick: () => void;
};

export const HostSearchButton = ({
  locale,
  onClick,
}: HostSearchButtonProps) => (
  <div className="absolute end-3 top-3 flex has-[:focus-visible]:z-40">
    <HostMapButton
      icon={Search}
      label={host_search_venues({}, { locale })}
      onClick={onClick}
    />
  </div>
);
