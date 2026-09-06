import {
  host_character_count,
  host_desc_label,
  host_desc_ph,
  host_required,
  host_title_label,
  host_title_ph,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

import type { HostCreateFieldErrors } from '../../features/events/host-create-validation';

export const HostDetailsStep = ({
  locale,
  title,
  description,
  constraints,
  errors,
  onTitleChange,
  onDescriptionChange,
}: {
  locale: Locale;
  title: string;
  description: string;
  constraints: {
    titleMin: number;
    titleMax: number;
    descriptionMin: number;
    descriptionMax: number;
  };
  errors: HostCreateFieldErrors;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) => (
  <div className="grid gap-5">
    <label className="form-control" htmlFor="host-title">
      <span className="mb-1 flex items-center justify-between gap-3 text-body-sm text-neutral">
        <span>{host_title_label({}, { locale })}</span>
        <span className="text-caption text-neutral">
          {host_required({}, { locale })}
        </span>
      </span>
      <Input
        id="host-title"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder={host_title_ph({}, { locale })}
        minLength={constraints.titleMin}
        maxLength={constraints.titleMax}
        required
        aria-invalid={!!errors.title}
        aria-describedby="host-title-count host-title-error"
      />
      <span
        id="host-title-count"
        className="mt-1 text-end text-caption text-neutral"
      >
        {host_character_count(
          { current: title.length, max: constraints.titleMax },
          { locale },
        )}
      </span>
      {errors.title && (
        <span id="host-title-error" className="mt-1 text-body-sm text-error">
          {errors.title}
        </span>
      )}
    </label>

    <label className="form-control" htmlFor="host-description">
      <span className="mb-1 flex items-center justify-between gap-3 text-body-sm text-neutral">
        <span>{host_desc_label({}, { locale })}</span>
        <span className="text-caption text-neutral">
          {host_required({}, { locale })}
        </span>
      </span>
      <textarea
        id="host-description"
        className="textarea textarea-bordered min-h-32 w-full"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder={host_desc_ph({}, { locale })}
        minLength={constraints.descriptionMin}
        maxLength={constraints.descriptionMax}
        required
        aria-invalid={!!errors.description}
        aria-describedby="host-description-count host-description-error"
      />
      <span
        id="host-description-count"
        className="mt-1 text-end text-caption text-neutral"
      >
        {host_character_count(
          {
            current: description.length,
            max: constraints.descriptionMax,
          },
          { locale },
        )}
      </span>
      {errors.description && (
        <span
          id="host-description-error"
          className="mt-1 text-body-sm text-error"
        >
          {errors.description}
        </span>
      )}
    </label>
  </div>
);
