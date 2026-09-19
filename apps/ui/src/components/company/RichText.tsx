import { Link } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { localizedLanding } from '../../lib/locale-routing';

type RichTextProps = {
  value: string;
  locale: Locale;
};

const LEGAL_PATHS: readonly string[] = [
  '/terms',
  '/privacy',
  '/cookies',
  '/community',
  '/organizers',
  '/legal',
];

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;

export const RichText = ({ value, locale }: RichTextProps) => (
  <>
    {value
      .split(TOKEN)
      .filter((part) => part.length > 0)
      .map((part, index) => {
        const key = `${index}-${part.slice(0, 24)}`;

        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={key} className="font-semibold text-base-content">
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={key}
              dir="ltr"
              className="rounded-md bg-base-200 px-1.5 py-0.5 font-mono text-[0.85em] text-base-content"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link && LEGAL_PATHS.includes(link[2])) {
          return (
            <Link
              key={key}
              {...localizedLanding(locale, link[2].slice(1))}
              className="font-medium text-base-content underline underline-offset-2 hover:text-primary"
            >
              {link[1]}
            </Link>
          );
        }

        return <span key={key}>{part}</span>;
      })}
  </>
);
