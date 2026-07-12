import { Link } from '@tanstack/react-router';

import { brand, type Locale } from '@founders-coffee/i18n';

import { SessionNav } from './SessionNav';

type NavbarProps = { locale: Locale };

export const Navbar = ({ locale }: NavbarProps) => (
  <nav className="sticky top-0 z-50 border-b border-base-300 bg-base-100/80 backdrop-blur mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
    <Link
      to="/"
      aria-label={brand({}, { locale })}
      className="flex items-center"
    >
      <img
        src="/logo-fc.svg"
        alt={brand({}, { locale })}
        width={65}
        height={65}
        className="h-[65px] w-auto"
      />
    </Link>
    <SessionNav locale={locale} />
  </nav>
);
