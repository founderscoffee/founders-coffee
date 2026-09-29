import {
  host_venue_name_helper,
  host_venue_name_label,
  host_venue_name_ph,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

type HostVenueNameFieldProps = {
  locale: Locale;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export const HostVenueNameField = ({
  locale,
  value,
  error,
  onChange,
}: HostVenueNameFieldProps) => (
  <div className="flex flex-col">
    <label className="mb-1 text-body-sm text-neutral" htmlFor="host-venue-name">
      {host_venue_name_label({}, { locale })}
    </label>
    <Input
      id="host-venue-name"
      value={value}
      maxLength={200}
      placeholder={host_venue_name_ph({}, { locale })}
      aria-invalid={!!error}
      aria-describedby="host-venue-name-help host-venue-name-error"
      onChange={(event) => onChange(event.target.value)}
    />
    <span id="host-venue-name-help" className="mt-1 text-caption text-neutral">
      {host_venue_name_helper({}, { locale })}
    </span>
    {error && (
      <span id="host-venue-name-error" className="mt-1 text-body-sm text-error">
        {error}
      </span>
    )}
  </div>
);
