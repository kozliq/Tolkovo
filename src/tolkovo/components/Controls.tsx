import type { ReactNode } from "react";

/** Burgundy switch from the Settings mockup (46×28). */
export const Switch = ({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className="tk-switch"
    data-on={checked ? "" : undefined}
    onClick={() => onChange(!checked)}
  >
    <span />
  </button>
);

/** White-pill segmented control ("Всегда / При записи"). */
export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) => (
  <div role="radiogroup" aria-label={label} className="tk-seg">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={o.value === value}
        data-on={o.value === value ? "" : undefined}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** One row of a settings group: title (+hint) on the left, control right. */
export const Row = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) => (
  <div className="tk-row">
    <div className="tk-row-text">
      <div className="tk-row-title">{title}</div>
      {hint && <div className="tk-row-hint">{hint}</div>}
    </div>
    {children}
  </div>
);

/** Native select styled as a glass control. */
export const Select = ({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) => (
  <select
    className="tk-select"
    aria-label={label}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);
