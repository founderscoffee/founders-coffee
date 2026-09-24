import { useId } from 'react';

import {
  profile_record_attended,
  profile_record_window,
  type Locale,
} from '@founders-coffee/i18n';

import type { PublicProfile } from '../api';

export const PublicProfileRecord = ({
  locale,
  profile,
}: {
  locale: Locale;
  profile: PublicProfile;
}) => {
  const windowId = useId();
  const attended = profile.attendedCount ?? 0;

  if (attended === 0) return null;

  return (
    <div>
      <p id={windowId} className="text-caption text-neutral">
        {profile_record_window({}, { locale })}
      </p>
      <ul
        aria-labelledby={windowId}
        className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body font-medium"
      >
        <li>{profile_record_attended({ count: attended }, { locale })}</li>
      </ul>
    </div>
  );
};
