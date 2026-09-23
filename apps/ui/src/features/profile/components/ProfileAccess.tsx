import { Link } from '@tanstack/react-router';

import {
  login_title,
  profile_loading,
  profile_load_error,
  profile_reload,
  type Locale,
} from '@founders-coffee/i18n';

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
      <p role="status">{profile_loading({}, { locale })}</p>
    ) : isAnonymous ? (
      <Link
        className="btn btn-primary"
        {...localizedLogin(locale)}
        search={{ redirect: returnPath }}
      >
        {login_title({}, { locale })}
      </Link>
    ) : (
      <>
        <p role="alert">{profile_load_error({}, { locale })}</p>
        <button type="button" className="btn btn-outline" onClick={onRetry}>
          {profile_reload({}, { locale })}
        </button>
      </>
    )}
  </div>
);
