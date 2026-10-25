import { useId } from "react";

export interface FilterChipOption<V extends string> {
  value: V;
  label: string;
}

export interface FilterChipsProps<V extends string> {
  label: string;
  labelHidden?: boolean;
  options: FilterChipOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
  id?: string;
}

export function FilterChips<V extends string>({
  label,
  labelHidden = false,
  options,
  value,
  onChange,
  className,
  id,
}: FilterChipsProps<V>) {
  const generatedId = useId();
  const labelId = id ?? generatedId;

  return (
    <div
      role="group"
      {...(labelHidden ? { "aria-label": label } : { "aria-labelledby": labelId })}
      className={className ? `filter-chips ${className}` : "filter-chips"}
    >
      {!labelHidden ? (
        <p id={labelId} className="filter-chips-label">
          {label}
        </p>
      ) : null}
      <div className="filter-chips-group">
        {options.map((option) => {
          const isPressed = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className="chip"
              aria-pressed={isPressed}
              onClick={() => {
                if (!isPressed) {
                  onChange(option.value);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
