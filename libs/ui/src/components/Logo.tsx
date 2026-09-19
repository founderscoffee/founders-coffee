import type { ImgHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

type LogoSymbolProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'alt' | 'height' | 'src' | 'width'
> & {
  size?: number;
};

export const LogoSymbol = ({
  size = 55,
  className,
  ...props
}: LogoSymbolProps) => {
  return (
    <img
      src="/branding/pwa-logo-165.webp"
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

type LogoProps = {
  symbolSize?: number;
  textClassName?: string;
  className?: string;
};

export const Logo = ({
  symbolSize = 55,
  textClassName = 'text-xl',
  className,
}: LogoProps) => (
  <span className={cn('inline-flex items-center gap-[0.32em]', className)}>
    <LogoSymbol size={symbolSize} />
    <LogoWordmark className={textClassName} />
  </span>
);
