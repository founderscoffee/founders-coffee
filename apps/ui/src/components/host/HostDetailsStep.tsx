import {
  host_desc_label,
  host_desc_ph,
  host_title_label,
  host_title_ph,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

import { Turnstile } from '../auth/Turnstile';
import { ScheduleSummary } from './ScheduleSummary';

export const HostDetailsStep = ({
  locale,
  timeZone,
  startsAt,
  endsAt,
  title,
  description,
  publishError,
  turnstileSiteKey,
  isTurnstileBypassed,
  turnstileResetKey,
  onTitleChange,
  onDescriptionChange,
  onTurnstileToken,
}: {
  locale: Locale;
  timeZone: string;
  startsAt: number | null;
  endsAt: number | null;
  title: string;
  description: string;
  publishError: string | null;
  turnstileSiteKey: string | null;
  isTurnstileBypassed: boolean;
  turnstileResetKey: number;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTurnstileToken: (token: string | null) => void;
}) => (
  <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
    {startsAt !== null && endsAt !== null && (
      <ScheduleSummary
        startsAt={startsAt}
        endsAt={endsAt}
        locale={locale}
        timeZone={timeZone}
      />
    )}
    <label className="form-control">
      <span className="mb-1 text-sm text-base-content/70">
        {host_title_label({}, { locale })}
      </span>
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={host_title_ph({}, { locale })}
        maxLength={120}
      />
    </label>
    <label className="form-control">
      <span className="mb-1 text-sm text-base-content/70">
        {host_desc_label({}, { locale })}
      </span>
      <textarea
        className="textarea textarea-bordered"
        rows={4}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={host_desc_ph({}, { locale })}
        maxLength={2000}
      />
    </label>
    {turnstileSiteKey && !isTurnstileBypassed && (
      <Turnstile
        sitekey={turnstileSiteKey}
        action="create_event"
        appearance="interaction-only"
        resetKey={turnstileResetKey}
        onToken={onTurnstileToken}
      />
    )}
    {publishError && (
      <p className="text-sm text-error" role="alert">
        {publishError}
      </p>
    )}
  </div>
);
