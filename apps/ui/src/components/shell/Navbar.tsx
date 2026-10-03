import { Link } from '@tanstack/react-router';

import {
  brand,
  nav_host,
  nav_host_short,
  type Locale,
} from '@founders-coffee/i18n';
import { Logo, LogoSymbol } from '@founders-coffee/ui';

import { OfflineNotice } from './OfflineNotice';
import { SessionNav } from './SessionNav';
import { ProfileMenuDrawer } from './ProfileMenuDrawer';
import { localizedHome, localizedHostCreate } from '../../lib/locale-routing';

type NavbarProps = {
  locale: Locale;
  marketSlug?: string;
  cityCode?: string;
  isHiddenOnMobile?: boolean;
};

const hostClass =
  'btn btn-primary btn-xs sm:btn-sm md:btn-md shrink-0 rounded-full border-0 font-semibold whitespace-nowrap shadow-none';

export const Navbar = ({
  locale,
  marketSlug,
  cityCode,
  isHiddenOnMobile = false,
}: NavbarProps) => {
  return (
    <header
      className={`sticky top-0 z-50 border-b border-base-300 bg-base-100 ${
        isHiddenOnMobile ? 'max-lg:hidden' : ''
      }`}
    >
      <nav
        aria-label={brand({}, { locale })}
        className="mx-auto flex min-h-14 max-w-content items-center justify-between gap-3 px-4 md:min-h-16 md:px-8"
      >
        <div className="flex shrink-0 items-center gap-2">
          <ProfileMenuDrawer locale={locale} />
          <Link
            {...localizedHome(locale, marketSlug)}
            aria-label={brand({}, { locale })}
            className="flex items-center rounded-field"
          >
            <LogoSymbol size={55} className="sm:hidden" />
            <Logo className="hidden sm:inline-flex" />
          </Link>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <div className="auth-slot">
            <SessionNav locale={locale} />
          </div>
          {marketSlug ? (
            <Link
              {...localizedHostCreate(locale, marketSlug, cityCode)}
              aria-label={nav_host({}, { locale })}
              className={hostClass}
            >
              {nav_host_short({}, { locale })}
            </Link>
          ) : null}
        </div>
      </nav>
      <OfflineNotice locale={locale} />
    </header>
  );
};
