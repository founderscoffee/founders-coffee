import { Link } from '@tanstack/react-router';

import {
  how_cta_faq,
  how_cta_host,
  how_step1_body,
  how_step1_title,
  how_step2_body,
  how_step2_title,
  how_step3_body,
  how_step3_title,
  how_title,
  type Locale,
} from '@founders-coffee/i18n';

import {
  localizedHostCreate,
  localizedLanding,
} from '../../lib/locale-routing';

type HowItWorksProps = { locale: Locale; marketSlug: string };

const STEPS = [
  { image: 'how-step1', title: how_step1_title, body: how_step1_body },
  { image: 'how-step2', title: how_step2_title, body: how_step2_body },
  { image: 'how-step3', title: how_step3_title, body: how_step3_body },
] as const;

const ctaClass =
  'inline-flex min-h-11 items-center rounded-full px-5 text-body-sm font-semibold transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none';

export const HowItWorks = ({ locale, marketSlug }: HowItWorksProps) => (
  <section
    aria-labelledby="how-it-works-title"
    className="mx-auto max-w-content px-4 pt-12 pb-2 md:px-8 md:pt-16"
  >
    <h2
      id="how-it-works-title"
      className="font-display text-h4 font-semibold text-base-content"
    >
      {how_title({}, { locale })}
    </h2>

    <ol className="mt-6 grid list-none grid-cols-1 gap-6 sm:grid-cols-3">
      {STEPS.map((step) => (
        <li
          key={step.image}
          className="flex flex-row items-center gap-4 sm:flex-col sm:items-stretch sm:gap-0"
        >
          <img
            src={`/images/${step.image}.webp`}
            alt=""
            width={1254}
            height={1254}
            loading="lazy"
            decoding="async"
            className="w-24 shrink-0 rounded-box border border-base-300 sm:w-full"
          />
          <div className="min-w-0 sm:mt-3">
            <h3 className="font-display text-body-lg font-semibold text-base-content">
              {step.title({}, { locale })}
            </h3>
            <p className="mt-1 text-body-sm leading-relaxed text-neutral">
              {step.body({}, { locale })}
            </p>
          </div>
        </li>
      ))}
    </ol>

    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        {...localizedHostCreate(locale, marketSlug)}
        className={`${ctaClass} bg-primary text-primary-content hover:bg-primary/90`}
      >
        {how_cta_host({}, { locale })}
      </Link>
      <Link
        {...localizedLanding(locale, 'faq')}
        className={`${ctaClass} text-neutral hover:text-base-content`}
      >
        {how_cta_faq({}, { locale })}
      </Link>
    </div>
  </section>
);
