import type { events } from '@founders-coffee/domain';
import {
  host_capacity,
  host_capacity_constraints,
  host_capacity_limited,
  host_capacity_unlimited,
  host_capacity_value,
  host_category,
  host_character_count,
  host_desc_label,
  host_desc_ph,
  host_language,
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
  capacity,
  language,
  category,
  constraints,
  languageOptions,
  categoryOptions,
  errors,
  onTitleChange,
  onDescriptionChange,
  onCapacityChange,
  onCapacityLimitChange,
  onLanguageChange,
  onCategoryChange,
}: {
  locale: Locale;
  title: string;
  description: string;
  capacity: number;
  language: Locale;
  category: events.EventCategory;
  constraints: {
    titleMin: number;
    titleMax: number;
    descriptionMin: number;
    descriptionMax: number;
    capacityMax: number;
  };
  languageOptions: readonly {
    value: Locale;
    label: string;
  }[];
  categoryOptions: readonly {
    value: events.EventCategory;
    label: string;
  }[];
  errors: HostCreateFieldErrors;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCapacityChange: (value: number) => void;
  onCapacityLimitChange: (enabled: boolean) => void;
  onLanguageChange: (value: Locale) => void;
  onCategoryChange: (value: events.EventCategory) => void;
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
        className="textarea textarea-bordered min-h-32"
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

    <fieldset className="rounded-xl border border-base-300 p-4">
      <legend className="px-1 text-body-sm font-semibold">
        {host_capacity({}, { locale })}
      </legend>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={capacity > 0}
          onChange={(event) => onCapacityLimitChange(event.target.checked)}
        />
        <span>
          {capacity > 0
            ? host_capacity_limited({}, { locale })
            : host_capacity_unlimited({}, { locale })}
        </span>
      </label>
      {capacity > 0 && (
        <label className="form-control mt-3" htmlFor="host-capacity">
          <span className="mb-1 text-body-sm text-neutral">
            {host_capacity_value({}, { locale })}
          </span>
          <Input
            id="host-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={constraints.capacityMax}
            step={1}
            value={capacity}
            onChange={(event) => onCapacityChange(Number(event.target.value))}
            aria-invalid={!!errors.capacity}
            aria-describedby="host-capacity-help host-capacity-error"
          />
          <span
            id="host-capacity-help"
            className="mt-1 text-caption text-neutral"
          >
            {host_capacity_constraints(
              { max: constraints.capacityMax },
              { locale },
            )}
          </span>
          {errors.capacity && (
            <span
              id="host-capacity-error"
              className="mt-1 text-body-sm text-error"
            >
              {errors.capacity}
            </span>
          )}
        </label>
      )}
    </fieldset>

    <div className="grid gap-4 sm:grid-cols-2">
      <label className="form-control" htmlFor="host-language">
        <span className="mb-1 text-body-sm text-neutral">
          {host_language({}, { locale })}
        </span>
        <select
          id="host-language"
          className="select select-bordered w-full"
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as Locale)}
          aria-invalid={!!errors.language}
        >
          {languageOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="form-control" htmlFor="host-category">
        <span className="mb-1 text-body-sm text-neutral">
          {host_category({}, { locale })}
        </span>
        <select
          id="host-category"
          className="select select-bordered w-full"
          value={category}
          onChange={(event) =>
            onCategoryChange(event.target.value as events.EventCategory)
          }
          aria-invalid={!!errors.category}
        >
          {categoryOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  </div>
);
