import { Link, useParams } from '@tanstack/react-router';

import {
  brand,
  nav_events,
  nav_host,
  type Locale,
} from '@founders-coffee/i18n';
import { Logo } from '@founders-coffee/ui';

import { SessionNav } from './SessionNav';

type NavbarProps = { locale: Locale };

const linkClass =
  'hidden h-8 items-center rounded-full px-3 text-body-sm font-medium transition-colors sm:inline-flex';

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
          <Logo />
        </Link>

        <div className="flex items-center gap-1.5">
          {market ? (
            <>
              <Link
                to="/$market"
                params={{ market }}
                className={`${linkClass} text-base-content`}
                activeProps={{ className: `${linkClass} bg-base-200` }}
                activeOptions={{ exact: true }}
              >
                {nav_events({}, { locale })}
              </Link>
              <Link
                to="/$market/host/create"
                params={{ market }}
                className={`${linkClass} text-neutral hover:text-base-content`}
                activeProps={{ className: `${linkClass} bg-base-200` }}
              >
                {nav_host({}, { locale })}
              </Link>
            </>
          ) : null}
          <SessionNav locale={locale} />
        </div>
      </div>
    </nav>
  );
};
