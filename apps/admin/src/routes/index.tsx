import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { admin_title } from '@founders-coffee/i18n';

import { LocaleToggle } from '../features/shell/LocaleToggle';
import { getOperatorStatus } from '../features/status/api';
import { OperatorStatus } from '../features/status/OperatorStatus';

const Operations = () => {
  const { locale } = Route.useRouteContext();
  const status = useQuery({
    queryKey: ['operator-status'],
    queryFn: () => getOperatorStatus(),
    retry: false,
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h3">{admin_title({}, { locale })}</h1>
        <LocaleToggle active={locale} />
      </header>
      <OperatorStatus
        locale={locale}
        status={status.data}
        isError={status.isError}
      />
    </main>
  );
};

export const Route = createFileRoute('/')({ component: Operations });
