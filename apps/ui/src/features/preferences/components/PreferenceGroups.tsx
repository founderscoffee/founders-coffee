import type { Locale } from '@founders-coffee/i18n';

import type { NotificationDraft } from '../draft';
import type { PushState } from '../push-state';
import { NotificationChannelGrid } from './NotificationChannelGrid';

export const CategoryGroup = ({
  locale,
  draft,
  pushState,
  isEnabling,
  onEnablePush,
  onChange,
}: {
  locale: Locale;
  draft: NotificationDraft;
  pushState: PushState;
  isEnabling: boolean;
  onEnablePush: () => Promise<boolean>;
  onChange: (changes: Partial<NotificationDraft>) => void;
}) => (
  <div>
    <NotificationChannelGrid
      locale={locale}
      draft={draft}
      pushState={pushState}
      isEnabling={isEnabling}
      onEnablePush={onEnablePush}
      onChange={onChange}
    />
  </div>
);
