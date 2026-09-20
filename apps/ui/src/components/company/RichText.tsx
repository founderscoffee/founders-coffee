import { Link } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { companyLinkKey } from '../../content/company';
import { localizedLanding } from '../../lib/locale-routing';

type RichTextProps = {
  value: string;
  locale: Locale;
};

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/u;

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

        const link = LINK.exec(part);
        if (!link) return <span key={key}>{part}</span>;

        const page = companyLinkKey(link[2]);
        if (!page) return <span key={key}>{link[1]}</span>;

        return (
          <Link
            key={key}
            {...localizedLanding(locale, page)}
            className="font-medium text-base-content underline underline-offset-2 hover:text-primary"
          >
            {link[1]}
          </Link>
        );
      })}
  </>
);
