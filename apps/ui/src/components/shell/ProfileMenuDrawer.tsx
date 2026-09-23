import { useId, useState } from 'react';

import { useLocation } from '@tanstack/react-router';

import {
  account_sections,
  profile_menu_close,
  profile_menu_open,
  type Locale,
} from '@founders-coffee/i18n';

import { ProfileSectionNav } from '../../features/account/components/ProfileSectionNav';
import { withoutLocale } from '../../lib/locale-routing';

const MenuIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    aria-hidden="true"
    className="size-5"
  >
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    aria-hidden="true"
    className="size-5"
  >
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

const isProfileRoute = (pathname: string) => {
  const bare = withoutLocale(pathname);
  return bare === '/profile' || bare.startsWith('/profile/');
};

export const ProfileMenuDrawer = ({ locale }: { locale: Locale }) => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  if (!isProfileRoute(pathname)) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-square size-9 min-h-9 lg:hidden"
        aria-label={profile_menu_open({}, { locale })}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <MenuIcon />
      </button>
      {isOpen ? (
        <dialog
          open
          aria-labelledby={titleId}
          className="fixed inset-0 z-[60] m-0 h-full w-full max-w-none bg-transparent p-0 lg:hidden"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 cursor-default bg-neutral/25"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute inset-y-0 end-0 flex w-[min(20rem,85vw)] flex-col bg-base-100 p-5 shadow-[var(--shadow-2)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2
                id={titleId}
                className="text-body font-semibold text-base-content"
              >
                {account_sections({}, { locale })}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-square size-9 min-h-9"
                aria-label={profile_menu_close({}, { locale })}
                onClick={() => setIsOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <ProfileSectionNav
              locale={locale}
              variant="drawer"
              onNavigate={() => setIsOpen(false)}
            />
          </aside>
        </dialog>
      ) : null}
    </>
  );
};
