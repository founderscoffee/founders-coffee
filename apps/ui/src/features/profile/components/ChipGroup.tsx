export const ChipGroup = <T extends string>({
  options,
  selected,
  labelFor,
  max,
  groupLabel,
  onToggle,
}: {
  options: readonly T[];
  selected: readonly T[];
  labelFor: (option: T) => string;
  max: number;
  groupLabel: string;
  onToggle: (option: T) => void;
}) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label={groupLabel}>
    {options.map((option) => {
      const isOn = selected.includes(option);
      const isBlocked = !isOn && selected.length >= max;
      return (
        <button
          key={option}
          type="button"
          aria-pressed={isOn}
          disabled={isBlocked}
          onClick={() => onToggle(option)}
          className={`inline-flex h-8 items-center rounded-full px-3.5 text-body-sm font-medium transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none ${
            isOn
              ? 'bg-secondary-tint text-accent ring-1 ring-secondary'
              : 'bg-base-200 text-base-content hover:bg-base-300'
          } ${isBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {labelFor(option)}
        </button>
      );
    })}
  </div>
);
