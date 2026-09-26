import type { ReactNode } from 'react';

import { host_step_counter, type Locale } from '@founders-coffee/i18n';

import { TOTAL_STEPS } from '../../features/events/useHostCreateWizard';
import { OfflineNotice } from '../shell/OfflineNotice';

type HostWizardHeaderProps = {
  locale: Locale;
  marketName: string;
  step: number;
  children: ReactNode;
};

export const HostWizardHeader = ({
  locale,
  marketName,
  step,
  children,
}: HostWizardHeaderProps) => (
  <div className="sticky top-0 z-40 border-b border-base-300 bg-base-100 lg:static lg:col-start-1 lg:row-start-1 lg:border-e lg:border-b-0">
    <div className="flex items-center px-3 py-1 lg:flex-col lg:items-stretch lg:gap-4 lg:px-7 lg:pt-7 lg:pb-0">
      <div className="hidden items-center justify-between gap-3 text-caption text-neutral lg:flex">
        <span className="truncate font-medium text-base-content">
          {marketName}
        </span>
        <span className="shrink-0">
          {host_step_counter({ current: step, total: TOTAL_STEPS }, { locale })}
        </span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
    <div className="lg:hidden">
      <OfflineNotice locale={locale} />
    </div>
  </div>
);
