import { useId } from 'react';

export const PreferenceToggle = ({
  label,
  note,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) => {
  const noteId = useId();
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-base-200 py-3 last:border-b-0">
      <label
        className="min-w-0 flex-1 cursor-pointer"
        htmlFor={`${noteId}-input`}
      >
        <span className="text-body-sm font-medium">{label}</span>
        {note && (
          <span id={noteId} className="mt-0.5 block text-caption text-neutral">
            {note}
          </span>
        )}
      </label>
      <input
        id={`${noteId}-input`}
        type="checkbox"
        role="switch"
        className="toggle toggle-primary shrink-0"
        checked={checked}
        disabled={disabled}
        aria-describedby={note ? noteId : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
};
