import { Link } from '@tanstack/react-router';

import { brand, nav_host, type Locale } from '@founders-coffee/i18n';
import { Logo, LogoSymbol } from '@founders-coffee/ui';

import { OfflineNotice } from './OfflineNotice';
import { SessionNav } from './SessionNav';
import { ProfileMenuDrawer } from './ProfileMenuDrawer';
import { localizedHome, localizedHostCreate } from '../../lib/locale-routing';

type NavbarProps = {
  locale: Locale;
  marketSlug?: string;
  isHiddenOnMobile?: boolean;
};

const hostClass =
  'tap-target my-1 inline-flex min-h-9 items-center rounded-full bg-primary px-3 py-1 text-center text-body-sm leading-tight font-semibold text-balance text-primary-content transition-colors duration-[var(--duration-fast)] hover:bg-primary/90 motion-reduce:transition-none sm:h-9 sm:shrink-0 sm:px-4 sm:py-0 sm:text-body sm:whitespace-nowrap';

export const Navbar = ({
  locale,
  marketSlug,
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
          {marketSlug ? (
            <Link
              {...localizedHostCreate(locale, marketSlug)}
              className={hostClass}
            >
              {nav_host({}, { locale })}
            </Link>
          ) : null}
          <div className="auth-slot">
            <SessionNav locale={locale} />
          </div>
        </div>
      </nav>
      <OfflineNotice locale={locale} />
    </header>
  );
};
