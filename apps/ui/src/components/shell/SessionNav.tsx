import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import {
  activity_nav,
  sign_in,
  sign_out,
  nav_signed_in_as,
  profile_loading,
  profile_title,
  live_status_connected,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus } from '@founders-coffee/ui';

import { useMyProfile } from '../../features/profile/hooks';
import { profilePhotoUrl } from '../../features/profile/photo-url';

import {
  localizedLogin,
  localizedProfile,
  localizedProfileActivity,
  withoutLocale,
} from '../../lib/locale-routing';
import { useAuth } from '../../lib/app-providers';
import {
  connectionLabel,
  presenceClass,
} from '../../features/events/components/live-badges';
import { useLivePresence } from '../../features/events/live-presence';
import { authClient } from '../../lib/auth';
import { useBoundedPending } from '../../lib/network-status';
import { writeAuthSlot } from '../../features/auth/session-hint';
import { ActivityIcon, ProfileIcon, SignOutIcon } from './SessionIcon';
import { useDismissableDetails } from './useDismissableDetails';

const initials = (name: string, email: string) => {
  const source = name.trim() === '' ? email : name;
  const parts = source.split(/[\s@._-]+/).filter((part) => part !== '');
  const letters = parts.slice(0, 2).map((part) => part.charAt(0));
  return letters.join('').toUpperCase() || '?';
};

const LoginLink = ({ locale }: { locale: Locale }) => (
  <Link
    {...localizedLogin(locale)}
    className="btn btn-ghost h-9 min-h-9 w-full shrink-0 rounded-full border-0 px-4 text-body font-semibold whitespace-nowrap text-base-content shadow-none hover:bg-base-200"
  >
    {sign_in({}, { locale })}
  </Link>
);

type SessionNavProps = { locale: Locale };

export const SessionNav = ({ locale }: SessionNavProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { data: profile, isPending } = useMyProfile();
  const isProfilePending = useBoundedPending(isPending);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const { ref, close } = useDismissableDetails();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    if (isLoading) return;
    const slot = isAuthenticated ? 'in' : 'out';
    writeAuthSlot(slot);
    document.documentElement.dataset.authSlot = slot;
  }, [isAuthenticated, isLoading]);
  const presence = useLivePresence();
  const pathname = useLocation({ select: (location) => location.pathname });

  if (!isMounted || isLoading || (isAuthenticated && isProfilePending))
    return (
      <LoadingStatus label={profile_loading({}, { locale })} isLabelHidden>
        <span
          aria-hidden="true"
          className="skeleton block size-8 shrink-0 rounded-full motion-reduce:animate-none"
        />
      </LoadingStatus>
    );

  if (!isAuthenticated || !user)
    return withoutLocale(pathname) === '/login' ? null : (
      <LoginLink locale={locale} />
    );

  const presenceLabel =
    presence === null
      ? null
      : presence === 'connected'
        ? live_status_connected({}, { locale })
        : connectionLabel(presence, locale);

  const photoAssetId =
    profile?.userId === user.id ? profile.photoAssetId : null;

  return (
    <details ref={ref} className="dropdown dropdown-end">
      <summary
        aria-label={profile_title({}, { locale })}
        className={`avatar ${presence ? presenceClass(presence) : ''} flex size-8 cursor-pointer list-none items-center justify-center rounded-full bg-base-200 text-xs font-semibold text-base-content`}
      >
        {presenceLabel && <span className="sr-only">{presenceLabel}</span>}
        {photoAssetId && photoAssetId !== failedPhoto ? (
          <img
            key={photoAssetId}
            src={profilePhotoUrl(photoAssetId, 'sm')}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
            onError={() => setFailedPhoto(photoAssetId)}
          />
        ) : (
          initials(user.name, user.email)
        )}
      </summary>
      <div className="dropdown-content z-50 mt-2 flex w-60 flex-col rounded-box border border-base-300 bg-base-100 p-1 shadow-[var(--shadow-2)]">
        <p className="px-3 pt-2 text-caption text-neutral">
          {nav_signed_in_as({}, { locale })}
        </p>
        <p className="truncate px-3 text-body-sm" title={user.email}>
          <bdi>{user.email}</bdi>
        </p>
        <div className="divider my-1" role="presentation" />
        <ul className="menu w-full p-0" onClick={close}>
          <li>
            <Link {...localizedProfile(locale)}>
              <ProfileIcon />
              {profile_title({}, { locale })}
            </Link>
          </li>
          <li>
            <Link {...localizedProfileActivity(locale)}>
              <ActivityIcon />
              {activity_nav({}, { locale })}
            </Link>
          </li>
          <li>
            <button type="button" onClick={() => authClient.signOut()}>
              <SignOutIcon locale={locale} />
              {sign_out({}, { locale })}
            </button>
          </li>
        </ul>
      </div>
    </details>
  );
};
