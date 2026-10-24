"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Notice } from "@/components/ui/Notice";

export interface AltaOption { value: string; label: string }

export interface AltaField<K extends string> {
  name: K;
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
 * Formulario de alta compartido por las entidades del panel; el envío lo resuelve
 * `useFormSubmission`. Lo que cambia por entidad son los campos y el `onSubmit`, cuyos `values`
 * solo tienen los `name` declarados en `fields`.
 */
export function AltaForm<K extends string>({ breadcrumb, heading, description, fields, submitLabel, blocked, filter, onSubmit }: {
  breadcrumb: BreadcrumbItem[];
  heading: string;
  description: string;
  fields: AltaField<K>[];
  submitLabel: string;
  /** Motivo por el que todavía no se puede enviar (opciones cargando o que no se pudieron traer). */
  blocked?: ReactNode;
  /** Controles que acotan las opciones del alta sin formar parte de ella. */
  filter?: ReactNode;
  /** Devuelve el mensaje de confirmación a mostrar. */
  onSubmit: (values: Record<K, string>) => Promise<string>;
}) {
  const headingId = useId();
  const { busy, errors, error, success, setSuccess, handleSubmit } = useFormSubmission({
    fields: fields.map((field) => field.name),
    validate: (values) => {
      const issues: Partial<Record<K, string>> = {};
      for (const field of fields) {
        const issue = field.validate(values[field.name]);
        if (issue) issues[field.name] = issue;
      }
      return issues;
    },
    onSubmit: async (values, form) => {
      const message = await onSubmit(values);
      form.reset();
      setSuccess(message);
    },
    // El backend ya devuelve el mensaje en español (duplicado, inexistente, entrada inválida).
    fallbackError: "No pudimos registrar el alta. Intentá nuevamente.",
  });

  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title={heading} description={description} breadcrumb={breadcrumb} />
    <Card variant="panel">
      {blocked}
      {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {filter}
      <form onSubmit={handleSubmit}noValidate aria-busy={busy}>
        {fields.map((field) => <FormField key={field.name} name={field.name} label={field.label} hint={field.hint} error={errors[field.name]} input={{ autoComplete: "off", numeric: field.numeric }} options={field.options} onChange={field.onChange} />)}
        <button className="button submit" disabled={busy || Boolean(blocked)}>{busy ? "Guardando…" : submitLabel}</button>
      </form>
    </Card>
    <div className="form-links"><Link href="/home/admin">Volver al panel de administración</Link></div>
  </section>;
}
