import { Link } from '@tanstack/react-router';

import { brand, type Locale } from '@founders-coffee/i18n';
import { Logo } from '@founders-coffee/ui';

import { SessionNav } from './SessionNav';

type NavbarProps = { locale: Locale };

export const Navbar = ({ locale }: NavbarProps) => (
  <nav className="sticky top-0 z-50 border-b border-base-300 bg-base-100">
    <div className="mx-auto flex h-14 max-w-content items-center justify-between px-4 md:h-16 md:px-8">
      <Link
        to="/"
        aria-label={brand({}, { locale })}
        className="flex items-center rounded-field"
      >
        <Logo />
      </Link>
      <SessionNav locale={locale} />
    </div>
  </nav>
);
