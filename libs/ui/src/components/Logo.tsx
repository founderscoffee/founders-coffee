import type { SVGProps } from 'react';

import { cn } from '../lib/cn.js';

type LogoSymbolProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number;
  isMono?: boolean;
  isReversed?: boolean;
};

export const LogoSymbol = ({
  size = 28,
  isMono = false,
  isReversed = false,
  ...props
}: LogoSymbolProps) => {
  const table = isReversed
    ? 'var(--color-base-100)'
    : 'var(--color-base-content)';
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
        fill={isMono ? table : 'var(--color-secondary)'}
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
