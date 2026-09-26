import { useNavigate } from '@tanstack/react-router';

import type { geo } from '@founders-coffee/domain';
import type { Locale } from '@founders-coffee/i18n';

import { localizedHostCreate } from '../../lib/locale-routing';

/**
 * Move the wizard to another city, the way a city page's host link opens it.
 *
 * The city travels in the address, so the loader resolves it and the map context follows it there.
 * The history entry is replaced rather than added: a city the host looked at on the way to theirs
 * is not a page to come back to. `onSwitch` runs first, for whatever belonged to the old city.
 */
export const useCitySwitch = ({
  locale,
  marketSlug,
  onSwitch,
}: {
  locale: Locale;
  marketSlug: string;
  onSwitch: () => void;
}) => {
  const navigate = useNavigate();

  return (city: geo.GeoCity) => {
    onSwitch();
    void navigate({
      ...localizedHostCreate(locale, marketSlug),
      search: { city: city.code },
      replace: true,
    });
  };
};
