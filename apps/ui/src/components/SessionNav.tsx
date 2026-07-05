import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { nav_login, nav_logout, type Locale } from '@founders-coffee/i18n';

import { authClient } from '../lib/auth';

const LoginLink = ({ locale }: { locale: Locale }) => (
  <Link
    to="/login"
    className="btn btn-outline btn-primary btn-sm hover:underline"
  >
    {nav_login({}, { locale })}
  </Link>
);

type SessionNavProps = { locale: Locale };

export const SessionNav = ({ locale }: SessionNavProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <LoginLink locale={locale} />;
  const { data: session } = authClient.useSession();
  if (!session) return <LoginLink locale={locale} />;
  return (
    <button
      type="button"
      onClick={() => authClient.signOut()}
      className="text-sm text-base-content/70 hover:text-primary"
    >
      {nav_logout({}, { locale })}
    </button>
  );
};
