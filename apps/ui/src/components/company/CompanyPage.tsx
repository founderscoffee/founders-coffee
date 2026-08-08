import { Link } from '@tanstack/react-router'
import { Check, Copy, Mail } from 'lucide-react'
import { useState } from 'react'

import {
  contact_copy_email,
  contact_copied_email,
  contact_email_cta,
  footer_cookies,
  footer_privacy,
  footer_terms,
  page_last_updated,
  page_legal_draft_notice,
  page_on_this_page,
  type Locale,
} from '@founders-coffee/i18n'

import type { CompanyPageContent } from '../../content/company'
import { CONTACT_EMAIL } from '../../content/company'

type CompanyPageProps = {
  locale: Locale
  content: CompanyPageContent
  /** Show mailto + copy actions (contact page). */
  showEmailActions?: boolean
  /** Which related legal links to show at the bottom. */
  related?: ReadonlyArray<'privacy' | 'terms' | 'cookies'>
  /** Show “product draft pending counsel” notice (Privacy / Terms / Cookies). */
  showLegalDraftNotice?: boolean
}

const sectionDomId = (heading: string, index: number) => {
  const slug = heading
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `s-${index}-${slug || 'section'}`
}

export const CompanyPage = ({
  locale,
  content,
  showEmailActions = false,
  related = ['privacy', 'terms', 'cookies'],
  showLegalDraftNotice = false,
}: CompanyPageProps) => {
  const [copied, setCopied] = useState(false)
  const showToc = content.sections.length >= 4
  const sections = content.sections.map((section, index) => ({
    ...section,
    id: sectionDomId(section.heading, index),
  }))

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <header className="mb-10 border-b border-base-300/80 pb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
          {content.title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-base-content/70">
          {content.description}
        </p>
        <p className="mt-4 text-sm text-base-content/40">
          {page_last_updated({ date: content.updated }, { locale })}
        </p>

        {showLegalDraftNotice ? (
          <p
            role="note"
            className="mt-4 rounded-xl border border-base-300/80 bg-base-200/60 px-4 py-3 text-sm leading-6 text-base-content/60"
          >
            {page_legal_draft_notice(
              { date: content.updated, email: CONTACT_EMAIL },
              { locale },
            )}
          </p>
        ) : null}

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
          aria-label={page_on_this_page({}, { locale })}
          className="mb-10 rounded-2xl border border-base-300/80 bg-base-200/50 p-5"
        >
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-base-content/45">
            {page_on_this_page({}, { locale })}
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[0.9375rem] leading-6 text-base-content/70 transition-colors hover:text-primary"
                >
                  <span className="me-2 text-base-content/35">{index + 1}.</span>
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
            <h2 className="text-xl font-bold tracking-tight text-base-content md:text-2xl">
              {section.heading}
            </h2>
            <div className="mt-4 space-y-4">
              {section.paragraphs.map((paragraph) => (
                <p
                  key={`${section.id}-${paragraph.slice(0, 40)}`}
                  className="text-[1.0125rem] leading-8 text-base-content/75"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {related.length > 0 ? (
        <nav
          aria-label="Related"
          className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-base-300/80 pt-6 text-sm text-base-content/50"
        >
          {related.includes('privacy') ? (
            <Link to="/privacy" className="hover:text-primary">
              {footer_privacy({}, { locale })}
            </Link>
          ) : null}
          {related.includes('terms') ? (
            <Link to="/terms" className="hover:text-primary">
              {footer_terms({}, { locale })}
            </Link>
          ) : null}
          {related.includes('cookies') ? (
            <Link to="/cookies" className="hover:text-primary">
              {footer_cookies({}, { locale })}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </article>
  )
}
