import {
  prefs_push,
  prefs_push_checking,
  prefs_push_denied,
  prefs_push_enable,
  prefs_push_install,
  prefs_push_not_requested,
  prefs_push_registered,
  prefs_push_undeliverable,
  prefs_push_unavailable,
  prefs_push_unregistered,
  prefs_push_unsupported,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { pushIsActionable, type PushState } from '../push-state';

const EXPLANATION: Record<PushState, (locale: Locale) => string> = {
  checking: (locale) => prefs_push_checking({}, { locale }),
  unsupported: (locale) => prefs_push_unsupported({}, { locale }),
  install_required: (locale) => prefs_push_install({}, { locale }),
  unavailable: (locale) => prefs_push_unavailable({}, { locale }),
  not_requested: (locale) => prefs_push_not_requested({}, { locale }),
  denied: (locale) => prefs_push_denied({}, { locale }),
  granted_unregistered: (locale) => prefs_push_unregistered({}, { locale }),
  delivery_unavailable: (locale) => prefs_push_undeliverable({}, { locale }),
  registered: (locale) => prefs_push_registered({}, { locale }),
};

export const PushRow = ({
  locale,
  state,
  isEnabling,
  onEnable,
}: {
  locale: Locale;
  state: PushState;
  isEnabling: boolean;
  onEnable: () => void;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-base-200 py-3 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-body-sm font-medium">{prefs_push({}, { locale })}</p>
      <p className="mt-0.5 text-caption text-neutral" aria-live="polite">
        {EXPLANATION[state](locale)}
      </p>
    </div>
    {pushIsActionable(state) && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isEnabling}
        onClick={onEnable}
      >
        {prefs_push_enable({}, { locale })}
      </Button>
    )}
  </div>
);
