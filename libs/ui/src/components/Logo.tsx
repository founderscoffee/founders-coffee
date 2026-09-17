import type { ImgHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

type LogoSymbolProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'alt' | 'height' | 'src' | 'width'
> & {
  size?: number;
};

export const LogoSymbol = ({
  size = 28,
  className,
  ...props
}: LogoSymbolProps) => {
  return (
    <img
      src="/branding/pwa-logo.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn('object-contain', className)}
      {...props}
    />
  );
};

export const LogoWordmark = ({ className }: { className?: string }) => (
  <span
    dir="ltr"
    lang="en"
    className={cn('font-display font-semibold tracking-tight', className)}
  >
    Founders Coffee
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
