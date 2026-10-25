"use client";

import { useEffect, useRef } from "react";
import { SELECT_PLACEHOLDER } from "@/lib/messages";

export interface FormFieldOption { value: string; label: string }

/**
 * Label, control, hint and error wired with `aria-describedby`. With `options` the control is a
 * `<select>` (uncontrolled unless `value` is given); otherwise an `<input>` described by `input`.
 */
export function FormField({ name, label, hint, error, input = {}, options, value, defaultValue = "", onChange, required = true }: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  input?: { type?: string; autoComplete?: string; numeric?: { min: number; max: number } };
  options?: FormFieldOption[];
  value?: string;
  /** Initial value of an uncontrolled `<select>`, applied again when it changes (options that load later). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  // React only reads `defaultValue` on mount; a preselected option that arrives later is applied here.
  useEffect(() => {
    if (value === undefined && defaultValue && selectRef.current) selectRef.current.value = defaultValue;
  }, [value, defaultValue]);
  const describedBy = [hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className="field">
    <label htmlFor={name}>{label}</label>
    {options
      ? <select ref={selectRef} id={name} name={name} {...(value === undefined ? { defaultValue } : { value })} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={(event) => onChange?.(event.target.value)}>
        <option value="">{SELECT_PLACEHOLDER}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      : <input id={name} name={name} type={input.numeric ? "number" : input.type ?? "text"} {...(input.numeric ?? {})} step={input.numeric ? 1 : undefined} autoComplete={input.autoComplete} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy} />}
    {hint ? <p id={`${name}-hint`} className="hint">{hint}</p> : null}
    {error ? <p id={`${name}-error`} className="field-error">Error: {error}</p> : null}
  </div>;
}
