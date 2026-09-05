import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import {
  nav_login,
  nav_logout,
  profile_title,
  type Locale,
} from '@founders-coffee/i18n';

import { useAuth } from '../../lib/app-providers';
import { authClient } from '../../lib/auth';

const initials = (name: string, email: string) => {
  const source = name.trim() === '' ? email : name;
  const parts = source.split(/[\s@._-]+/).filter((part) => part !== '');
  const letters = parts.slice(0, 2).map((part) => part.charAt(0));
  return letters.join('').toUpperCase() || '?';
};

const LoginLink = ({ locale }: { locale: Locale }) => (
  <Link
    to="/login"
    className="btn btn-secondary h-9 min-h-9 rounded-full border-0 px-4 text-body-sm font-semibold shadow-none"
  >
    {nav_login({}, { locale })}
  </Link>
);

type SessionNavProps = { locale: Locale };

export const SessionNav = ({ locale }: SessionNavProps) => {
  const { isAuthenticated, user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted || !isAuthenticated || !user)
    return <LoginLink locale={locale} />;

  return (
    <details className="dropdown dropdown-end">
      <summary
        aria-label={profile_title({}, { locale })}
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-full bg-base-200 text-xs font-semibold text-base-content"
      >
        {initials(user.name, user.email)}
      </summary>
      <ul className="dropdown-content menu z-50 mt-2 w-44 rounded-box border border-base-300 bg-base-100 p-1 shadow-[var(--shadow-2)]">
        <li>
          <Link to="/profile">{profile_title({}, { locale })}</Link>
        </li>
        <li>
          <button type="button" onClick={() => authClient.signOut()}>
            {nav_logout({}, { locale })}
          </button>
        </li>
      </ul>
    </details>
  );
};
