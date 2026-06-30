import { Link } from '@tanstack/react-router'

import { brand, type Locale } from '@founders-coffee/i18n'

import { SessionNav } from './SessionNav'

type NavbarProps = { locale: Locale }

export const Navbar = ({ locale }: NavbarProps) => (
  <nav className="sticky top-0 z-50 border-b border-base-300 bg-base-100/80 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
      <Link to="/" className="text-lg font-extrabold text-primary">
        {brand({}, { locale })}
      </Link>
      <SessionNav locale={locale} />
    </div>
  </nav>
)
