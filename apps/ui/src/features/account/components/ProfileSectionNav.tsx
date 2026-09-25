import { Link } from '@tanstack/react-router';

import {
  localizedProfile,
  localizedProfileAccount,
  localizedProfileActivity,
  localizedProfileNotifications,
} from '../../../lib/locale-routing';

import {
  account,
  account_sections,
  activity,
  notifications,
  profile_link,
  type Locale,
} from '@founders-coffee/i18n';

const GLYPHS = {
  activity: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  account: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
};

const Icon = ({ name }: { name: keyof typeof GLYPHS }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-[18px] shrink-0"
  >
    {GLYPHS[name]}
  </svg>
);

const SECTIONS = [
  {
    at: localizedProfile,
    name: 'profile',
    label: profile_link,
    exact: true,
  },
  {
    at: localizedProfileActivity,
    name: 'activity',
    label: activity,
    exact: false,
  },
  {
    at: localizedProfileNotifications,
    name: 'notifications',
    label: notifications,
    exact: false,
  },
  {
    at: localizedProfileAccount,
    name: 'account',
    label: account,
    exact: false,
  },
] as const;

export const ProfileSectionNav = ({
  locale,
  variant = 'sidebar',
  onNavigate,
}: {
  locale: Locale;
  variant?: 'sidebar' | 'drawer';
  onNavigate?: () => void;
}) => (
  <nav
    aria-label={account_sections({}, { locale })}
    className={
      variant === 'sidebar'
        ? 'mb-6 hidden self-start lg:sticky lg:top-16 lg:mb-0 lg:block'
        : 'w-full'
    }
  >
    <ul className="menu w-full gap-1.5 p-0">
      {SECTIONS.map((section) => (
        <li key={section.name}>
          <Link
            {...section.at(locale)}
            activeOptions={{ exact: section.exact }}
            className="gap-3 text-body-sm"
            onClick={onNavigate}
            activeProps={{
              className: 'bg-base-200! font-medium text-base-content',
            }}
            inactiveProps={{ className: 'text-neutral' }}
          >
            <Icon name={section.name} />
            {section.label({}, { locale })}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);
