import { Link } from '@tanstack/react-router';

import { brand, nav_host, type Locale } from '@founders-coffee/i18n';
import { Logo, LogoSymbol } from '@founders-coffee/ui';

import { OfflineNotice } from './OfflineNotice';
import { SessionNav } from './SessionNav';
import { ProfileMenuDrawer } from './ProfileMenuDrawer';

type NavbarProps = { locale: Locale; marketSlug?: string };

const hostClass =
  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-4 text-body font-semibold text-primary-content transition-colors duration-[var(--duration-fast)] hover:bg-primary/90 motion-reduce:transition-none';

export const Navbar = ({ locale, marketSlug }: NavbarProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-base-300 bg-base-100">
      <nav
        aria-label={brand({}, { locale })}
        className="mx-auto flex h-14 max-w-content items-center justify-between px-4 md:h-16 md:px-8"
      >
        <div className="flex items-center gap-2">
          <ProfileMenuDrawer locale={locale} />
          <Link
            to="/"
            aria-label={brand({}, { locale })}
            className="flex items-center rounded-field"
          >
            <LogoSymbol size={55} className="sm:hidden" />
            <Logo className="hidden sm:inline-flex" />
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {marketSlug ? (
            <Link
              to="/$market/host/create"
              params={{ market: marketSlug }}
              className={hostClass}
            >
              {nav_host({}, { locale })}
            </Link>
          ) : null}
          <SessionNav locale={locale} />
        </div>
      </nav>
      <OfflineNotice locale={locale} />
    </header>
  );
};
