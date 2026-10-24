"use client";

import { useRef, useState, type FormEvent } from "react";

/**
 * Submit flow shared by the forms: reads the uncontrolled `fields` with FormData, validates,
 * focuses the first invalid field, ignores a second submit while one is in flight, and turns a
 * thrown error into `error` (its message, or `fallbackError`). Render `error` with
 * `<Notice focusOnShow>` so it takes focus.
 */
export function useFormSubmission<K extends string>({ fields, validate, onSubmit, fallbackError }: {
  fields: readonly K[];
  validate: (values: Record<K, string>) => Partial<Record<K, string>>;
  /** Gets the form to reset it; throw to show an error. */
  onSubmit: (values: Record<K, string>, form: HTMLFormElement) => Promise<void>;
  fallbackError: string;
}) {
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {} as Record<K, string>;
    for (const field of fields) values[field] = String(data.get(field) ?? "");
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setError("");
    setSuccess("");
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await onSubmit(values, form);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : fallbackError);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return { busy, errors, error, setError, success, setSuccess, handleSubmit };
}
