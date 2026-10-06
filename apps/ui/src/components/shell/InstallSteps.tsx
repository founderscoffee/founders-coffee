import { Share, SquarePlus } from 'lucide-react';

import {
  install_prompt_step_add,
  install_prompt_step_share,
  type Locale,
} from '@founders-coffee/i18n';

type InstallStepsProps = { locale: Locale };

export const InstallSteps = ({ locale }: InstallStepsProps) => {
  const steps = [
    { Icon: Share, label: install_prompt_step_share({}, { locale }) },
    { Icon: SquarePlus, label: install_prompt_step_add({}, { locale }) },
  ];

  return (
    <ol className="mt-3 flex flex-col gap-2">
      {steps.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-3 rounded-field bg-base-200 px-3 py-2 text-body-sm text-base-content"
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-base-100"
          >
            <Icon className="size-4 text-accent" />
          </span>
          <span className="min-w-0">{label}</span>
        </li>
      ))}
    </ol>
  );
};
