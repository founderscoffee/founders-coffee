import { Link } from '@tanstack/react-router';

import {
  sign_in,
  profile_loading,
  profile_load_error,
  profile_reload,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

import { localizedLogin } from '../../../lib/locale-routing';

export const ProfileAccess = ({
  locale,
  isLoading,
  isAnonymous,
  returnPath,
  onRetry,
}: {
  locale: Locale;
  isLoading: boolean;
  isAnonymous: boolean;
  returnPath: string;
  onRetry: () => void;
}) => (
  <div className="space-y-4" aria-live="polite">
    {isLoading ? (
      <LoadingStatus label={profile_loading({}, { locale })} />
    ) : isAnonymous ? (
      <Link
        className="btn btn-primary"
        {...localizedLogin(locale)}
        search={{ redirect: returnPath }}
      >
        {sign_in({}, { locale })}
      </Link>
    ) : (
      <StatusMessage
        variant="error"
        action={
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onRetry}
          >
            {profile_reload({}, { locale })}
          </button>
        }
      >
        {profile_load_error({}, { locale })}
      </StatusMessage>
    )}
  </div>
);
