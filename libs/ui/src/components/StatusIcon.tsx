import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';

import type { StatusVariant } from '../lib/status.js';

const ICONS = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
} as const;

export const StatusIcon = ({
  variant,
  className,
}: {
  variant: StatusVariant;
  className?: string;
}) => {
  const Icon = ICONS[variant];
  return <Icon className={className} aria-hidden="true" />;
};
