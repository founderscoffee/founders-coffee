import type { ReactNode } from 'react';

import { LogoSymbol } from '@founders-coffee/ui';

type EmptyStateProps = {
  title: string;
  headingLevel?: 'h1' | 'h2';
  body?: string;
  action?: ReactNode;
  secondary?: ReactNode;
};

export const EmptyState = ({
  title,
  headingLevel = 'h2',
  body,
  action,
  secondary,
}: EmptyStateProps) => (
  <section className="mx-auto flex max-w-[460px] flex-col items-center gap-2.5 px-6 py-12 text-center">
    <LogoSymbol size={55} />
    {headingLevel === 'h1' ? (
      <h1 className="font-display text-h4 font-semibold">{title}</h1>
    ) : (
      <h2 className="font-display text-h4 font-semibold">{title}</h2>
    )}
    {body ? (
      <p className="max-w-[320px] text-body-sm leading-relaxed text-neutral">
        {body}
      </p>
    ) : null}
    {action ? <div className="mt-1.5">{action}</div> : null}
    {secondary}
  </section>
);
