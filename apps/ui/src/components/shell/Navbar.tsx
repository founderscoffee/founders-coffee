import { Link, useParams } from '@tanstack/react-router';

import { brand, nav_host, type Locale } from '@founders-coffee/i18n';
import { Logo, LogoSymbol } from '@founders-coffee/ui';

import { SessionNav } from './SessionNav';

type NavbarProps = { locale: Locale };

const hostClass =
  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-4 text-body-sm font-semibold text-primary-content transition-colors duration-[var(--duration-fast)] hover:bg-primary/90 motion-reduce:transition-none';

export const Navbar = ({ locale }: NavbarProps) => {
  const params = useParams({ strict: false });
  const market = params.market;

  return (
    <nav className="sticky top-0 z-50 border-b border-base-300 bg-base-100">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between px-4 md:h-16 md:px-8">
        <Link
          to="/"
          aria-label={brand({}, { locale })}
          className="flex items-center rounded-field"
        >
          <LogoSymbol size={28} className="sm:hidden" />
          <span className="hidden sm:inline-flex">
            <Logo />
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {market ? (
            <Link
              to="/$market/host/create"
              params={{ market }}
              className={hostClass}
            >
              {nav_host({}, { locale })}
            </Link>
          ) : null}
          <SessionNav locale={locale} />
        </div>
      </div>
    </nav>
  );
};
