import type { Ref } from 'react';

import {
  host_page_title,
  host_repeat_notice,
  type Locale,
} from '@founders-coffee/i18n';

type HostStepHeadingProps = {
  locale: Locale;
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  sub: string | null;
  repeatTitle: string | null;
};

export const HostStepHeading = ({
  locale,
  headingRef,
  title,
  sub,
  repeatTitle,
}: HostStepHeadingProps) => (
  <div className="max-lg:contents lg:mb-2">
    <h1 className="sr-only">{host_page_title({}, { locale })}</h1>
    <h2
      ref={headingRef}
      tabIndex={-1}
      className="font-display text-h3 font-semibold text-base-content outline-none max-lg:sr-only max-lg:scroll-mt-20"
    >
      {title}
    </h2>
    {sub && <p className="text-body text-neutral lg:mt-1">{sub}</p>}
    {repeatTitle !== null ? (
      <p
        className="rounded-box bg-secondary-tint px-3 py-2 text-body-sm text-base-content lg:mt-3"
        role="note"
      >
        {host_repeat_notice({ title: repeatTitle }, { locale })}
      </p>
    ) : null}
  </div>
);
