import { Link } from '@tanstack/react-router';
import { Check, Copy, Mail } from 'lucide-react';
import { useState } from 'react';

import {
  contact_copy_email,
  contact_copied_email,
  contact_email_cta,
  footer_community,
  footer_cookies,
  footer_legal_info,
  footer_organizers,
  footer_privacy,
  footer_terms,
  page_arabic_source_notice,
  page_last_updated,
  page_on_this_page,
  type Locale,
} from '@founders-coffee/i18n';

import type { CompanyPageContent, RelatedKey } from '../../content/company';
import { CONTACT_EMAIL } from '../../content/company';

import { localizedLanding } from '../../lib/locale-routing';

import { CompanyBlocks } from './CompanyBlocks';

type CompanyPageProps = {
  locale: Locale;
  content: CompanyPageContent;
  showEmailActions?: boolean;
  related?: readonly RelatedKey[];
  arabicSource?: boolean;
};

const RELATED_LINKS = [
  { key: 'terms', label: footer_terms },
  { key: 'privacy', label: footer_privacy },
  { key: 'cookies', label: footer_cookies },
  { key: 'community', label: footer_community },
  { key: 'organizers', label: footer_organizers },
  { key: 'legal', label: footer_legal_info },
] as const;

const sectionDomId = (heading: string, index: number) => {
  const slug = heading
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `s-${index}-${slug || 'section'}`;
};

export const CompanyPage = ({
  locale,
  content,
  showEmailActions = false,
  related = ['privacy', 'terms', 'cookies'],
  arabicSource = false,
}: CompanyPageProps) => {
  const [copied, setCopied] = useState(false);
  const showToc = content.sections.length >= 4;
  const translated = arabicSource && locale !== 'ar';
  const textLocale: Locale = arabicSource ? 'ar' : locale;
  const sections = content.sections.map((section, index) => ({
    ...section,
    id: sectionDomId(section.heading, index),
  }));

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      {translated ? (
        <p
          role="note"
          dir="ltr"
          lang={locale}
          className="mb-8 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-body-sm leading-6 text-neutral"
        >
          {page_arabic_source_notice({ email: CONTACT_EMAIL }, { locale })}
        </p>
      ) : null}

      <div
        dir={arabicSource ? 'rtl' : undefined}
        lang={arabicSource ? 'ar' : undefined}
      >
        <header className="mb-10 border-b border-base-300 pb-8">
          <h1 className="font-display text-h2 font-semibold text-balance md:text-h1">
            {content.title}
          </h1>
          <p className="mt-3 max-w-2xl text-body-lg leading-8 text-neutral">
            {content.description}
          </p>
          <p className="mt-4 text-body-sm text-neutral">
            {page_last_updated(
              { date: content.updated },
              { locale: textLocale },
            )}
          </p>

          {showEmailActions ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="btn btn-primary btn-sm h-10 gap-2 px-4 font-semibold shadow-none"
              >
                <Mail className="size-3.5" aria-hidden="true" />
                {contact_email_cta({ address: CONTACT_EMAIL }, { locale })}
              </a>
              <button
                type="button"
                onClick={() => void copyEmail()}
                className="btn btn-outline btn-sm h-10 gap-2 px-4 font-medium"
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied
                  ? contact_copied_email({}, { locale })
                  : contact_copy_email({}, { locale })}
              </button>
            </div>
          ) : null}
        </header>

        {showToc ? (
          <nav
            aria-label={page_on_this_page({}, { locale: textLocale })}
            className="mb-10 rounded-2xl border border-base-300 bg-base-200 p-5"
          >
            <p className="eyebrow">
              {page_on_this_page({}, { locale: textLocale })}
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="inline-flex min-h-6 items-center text-body-sm leading-6 text-neutral transition-colors hover:text-primary"
                  >
                    <span className="me-2">{index + 1}.</span>
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-display text-h4 font-semibold text-base-content md:text-h3">
                {section.heading}
              </h2>
              <div className="mt-4">
                <CompanyBlocks blocks={section.blocks} locale={locale} />
              </div>
            </section>
          ))}
        </div>
      </div>

      {related.length > 0 ? (
        <nav
          aria-label="Related"
          className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-base-300 pt-6 text-body-sm text-neutral"
        >
          {RELATED_LINKS.filter((item) => related.includes(item.key)).map(
            (item) => (
              <Link
                key={item.key}
                {...localizedLanding(locale, item.key)}
                className="inline-flex min-h-6 items-center hover:text-primary"
              >
                {item.label({}, { locale })}
              </Link>
            ),
          )}
        </nav>
      ) : null}
    </article>
  );
};
