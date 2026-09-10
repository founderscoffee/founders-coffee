import { Link } from '@tanstack/react-router';

import {
  account_nav_account,
  account_nav_profile,
  account_sections,
  activity_nav,
  prefs_nav,
  type Locale,
} from '@founders-coffee/i18n';

const PATHS = {
  activity:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  profile:
    '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  preferences:
    '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  account:
    '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
} as const;

const Icon = ({ name }: { name: keyof typeof PATHS }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-[18px] shrink-0"
    dangerouslySetInnerHTML={{ __html: PATHS[name] }}
  />
);

const SECTIONS = [
  { to: '/profile', name: 'profile', label: account_nav_profile },
  { to: '/activity', name: 'activity', label: activity_nav },
  { to: '/preferences', name: 'preferences', label: prefs_nav },
  { to: '/account', name: 'account', label: account_nav_account },
] as const;

export const ProfileSectionNav = ({ locale }: { locale: Locale }) => (
  <nav
    aria-label={account_sections({}, { locale })}
    className="mb-6 self-start lg:sticky lg:top-7 lg:mb-0"
  >
    <ul className="menu w-full gap-1.5 p-0 lg:menu-vertical max-lg:menu-horizontal max-lg:rounded-box max-lg:bg-base-200 max-lg:p-1">
      {SECTIONS.map((section) => (
        <li key={section.to}>
          <Link
            to={section.to}
            className="gap-3 text-body-sm"
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
