import { Link } from '@tanstack/react-router';

import {
  account_nav_account,
  account_nav_profile,
  account_sections,
  type Locale,
} from '@founders-coffee/i18n';

export const ProfileSectionNav = ({ locale }: { locale: Locale }) => (
  <nav aria-label={account_sections({}, { locale })} className="mb-6">
    <ul className="menu menu-horizontal gap-1 rounded-box bg-base-200 p-1">
      <li>
        <Link to="/profile" activeProps={{ className: 'menu-active' }}>
          {account_nav_profile({}, { locale })}
        </Link>
      </li>
      <li>
        <Link to="/account" activeProps={{ className: 'menu-active' }}>
          {account_nav_account({}, { locale })}
        </Link>
      </li>
    </ul>
  </nav>
);
