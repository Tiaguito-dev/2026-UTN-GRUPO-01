"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/academic/Breadcrumb";

export interface AltaOption { value: string; label: string }

export interface AltaField {
  name: string;
  label: string;
  hint?: string;
  /** Presente ⇒ el campo se renderiza como `<select>`. */
  options?: AltaOption[];
  numeric?: { min: number; max: number };
  /** Para selects que condicionan al resto del formulario (materia → cursada). */
  onChange?: (value: string) => void;
  validate: (value: string) => string | undefined;
}

/**
 * Formulario de alta compartido por las 4 entidades del panel: mismo recorrido que
 * `AccountForm` (campos no controlados leídos con FormData, validación local antes de enviar,
 * foco al primer campo inválido, envío bloqueado mientras hay una solicitud en curso) sin
 * repetirlo cuatro veces. Lo que cambia por entidad son los campos y el `onSubmit`.
 */
export function AltaForm({ breadcrumb, heading, description, fields, submitLabel, blocked, filter, onSubmit }: {
  breadcrumb: BreadcrumbItem[];
  heading: string;
  description: string;
  fields: AltaField[];
  submitLabel: string;
  /** Motivo por el que todavía no se puede enviar (opciones cargando o que no se pudieron traer). */
  blocked?: ReactNode;
  /** Controles que acotan las opciones del alta sin formar parte de ella. */
  filter?: ReactNode;
  /** Devuelve el mensaje de confirmación a mostrar. */
  onSubmit: (values: Record<string, string>) => Promise<string>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: Record<string, string> = {};
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      values[field.name] = String(data.get(field.name) ?? "");
      const issue = field.validate(values[field.name]);
      if (issue) nextErrors[field.name] = issue;
    }
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
      const message = await onSubmit(values);
      form.reset();
      setSuccess(message);
    } catch (failure) {
      // El backend ya devuelve el mensaje en español (duplicado, inexistente, entrada inválida).
      setError(failure instanceof Error ? failure.message : "No pudimos registrar el alta. Intentá nuevamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section aria-labelledby="alta-heading">
    <Breadcrumb items={breadcrumb} />
    <h1 ref={headingRef} tabIndex={-1} id="alta-heading">{heading}</h1>
    <p className="system-description">{description}</p>
    <div className="academic-panel">
      {blocked}
      {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="notice error">{error}</div> : null}
      {success ? <div role="status" className="notice success">{success}</div> : null}
      {filter}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        {fields.map((field) => {
          const issue = errors[field.name];
          const describedBy = [field.hint ? `${field.name}-hint` : "", issue ? `${field.name}-error` : ""].filter(Boolean).join(" ") || undefined;
          return <div className="field" key={field.name}>
            <label htmlFor={field.name}>{field.label}</label>
            {field.options
              ? <select id={field.name} name={field.name} defaultValue="" required aria-invalid={Boolean(issue)} aria-describedby={describedBy} onChange={(event) => field.onChange?.(event.target.value)}>
                <option value="">Elegí una opción</option>
                {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              : <input id={field.name} name={field.name} type={field.numeric ? "number" : "text"} {...(field.numeric ?? {})} step={field.numeric ? 1 : undefined} autoComplete="off" required aria-invalid={Boolean(issue)} aria-describedby={describedBy} />}
            {field.hint ? <p id={`${field.name}-hint`} className="hint">{field.hint}</p> : null}
            {issue ? <p id={`${field.name}-error`} className="field-error">Error: {issue}</p> : null}
          </div>;
        })}
        <button className="submit" disabled={busy || Boolean(blocked)}>{busy ? "Guardando…" : submitLabel}</button>
      </form>
    </div>
    <div className="form-links"><Link href="/home/admin">Volver al panel de administración</Link></div>
  </section>;
}
