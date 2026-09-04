import type { SVGProps } from 'react';

import { cn } from '../lib/cn.js';

type LogoTone = 'default' | 'reversed' | 'mono' | 'muted';

const TABLE_FILL: Record<LogoTone, string> = {
  default: 'var(--color-base-content)',
  reversed: 'var(--color-base-100)',
  mono: 'var(--color-base-content)',
  muted: 'var(--color-base-200)',
};

type LogoSymbolProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number;
  tone?: LogoTone;
};

export const LogoSymbol = ({
  size = 28,
  tone = 'default',
  ...props
}: LogoSymbolProps) => {
  const table = TABLE_FILL[tone];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="46" cy="46" r="34" fill={table} />
      <circle
        cx="80"
        cy="80"
        r="12"
        fill={tone === 'mono' ? table : 'var(--color-secondary)'}
      />
    </svg>
  );
};

export const LogoWordmark = ({ className }: { className?: string }) => (
  <span
    dir="ltr"
    lang="en"
    className={cn('font-display font-semibold tracking-tight', className)}
  >
    founders<span className="text-secondary">.</span>coffee
  </span>
);

type LogoProps = { symbolSize?: number; textClassName?: string };

export const Logo = ({
  symbolSize = 28,
  textClassName = 'text-lg',
}: LogoProps) => (
  <span className="inline-flex items-center gap-[0.32em]">
    <LogoSymbol size={symbolSize} />
    <LogoWordmark className={textClassName} />
  </span>
);
