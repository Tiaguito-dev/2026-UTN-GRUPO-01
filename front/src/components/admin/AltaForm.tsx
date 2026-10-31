"use client";

import { useEffect, useId, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminCreationHref, joinedReturnTo } from "@/validations/admin";
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
  /** Valor inicial de un select (precarga por query); se aplica cuando llega o cambia. */
  defaultValue?: string;
  value?: string;
  /** Carrera única: contexto visible sin solicitar una selección. */
  readOnlyValue?: string;
  /** Para selects que condicionan al resto del formulario (materia → cursada). */
  onChange?: (value: string) => void;
  validate: (value: string) => string | undefined;
}

export interface AltaFormFieldsProps<K extends string> {
  fields: AltaField<K>[];
  submitLabel: string;
  /** Motivo por el que todavía no se puede enviar (opciones cargando o que no se pudieron traer). */
  blocked?: ReactNode;
  /** Controles que acotan las opciones del alta sin formar parte de ella. */
  filter?: ReactNode;
  /** Devuelve el mensaje de confirmación a mostrar. */
  onSubmit: (values: Record<K, string>) => Promise<string>;
  /** Si se pasa, se llama con el mensaje en vez de mostrarlo en el lugar. */
  onSuccess?: (message: string, values: Record<K, string>) => void;
  onCancel?: () => void;
  /** Dentro de un `Dialog` (TASK-054, "Alta en modal"): su `busy` sigue el envío. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Cuerpo del formulario de alta; resuelve el envío con `useFormSubmission`.
 * Sin `PageHeader` ni envoltorio de página, apto para modal o página.
 */
export function AltaFormFields<K extends string>({
  fields,
  submitLabel,
  blocked,
  filter,
  onSubmit,
  onSuccess,
  onCancel,
  onBusyChange,
}: AltaFormFieldsProps<K>) {
  const { busy, errors, error, success, setSuccess, handleSubmit, handleChange } = useFormSubmission({
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
      if (blocked) return;
      const message = await onSubmit(values);
      if (onSuccess) {
        onSuccess(message, values);
      } else {
        setSuccess(message);
      }
      form.reset();
    },
    // El backend ya devuelve el mensaje en español (duplicado, inexistente, entrada inválida).
    fallbackError: "No pudimos registrar el alta. Intentá nuevamente.",
  });
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  return <>
    {blocked}
    {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    {success ? <Notice tone="success">{success}</Notice> : null}
    {filter}
    <form onSubmit={handleSubmit} onChange={handleChange} noValidate aria-busy={busy}>
      {fields.map((field) => field.readOnlyValue !== undefined ? <div className="field" key={field.name}><span>{field.label}</span><p>{field.readOnlyValue}</p><input type="hidden" name={field.name} value={field.value ?? field.defaultValue ?? ""} />{errors[field.name] ? <p className="field-error" role="alert">{errors[field.name]}</p> : null}</div> : <FormField key={field.name} name={field.name} value={field.value} defaultValue={field.defaultValue} label={field.label} hint={field.hint} error={errors[field.name]} input={{ autoComplete: "off", numeric: field.numeric }} options={field.options} onChange={field.onChange} />)}
      <div className={onCancel ? "dialog-actions" : undefined}>
        {onCancel ? <button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button> : null}
        <button className={`button ${onCancel ? "" : "submit"}`} disabled={busy || Boolean(blocked)}>{busy ? "Guardando…" : submitLabel}</button>
      </div>
    </form>
  </>;
}

/**
 * Formulario de alta compartido por las entidades del panel; envuelve a `AltaFormFields`
 * en `section`, `PageHeader` y `Card panel`.
 */
export function AltaForm<K extends string>({ breadcrumb, heading, description, fields, submitLabel, blocked, filter, onSubmit, onSuccess, defaultReturnTo }: {
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
  onSuccess?: (message: string) => void;
  defaultReturnTo?: string | ((values: Record<K, string>) => string);
}) {
  const headingId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const explicitReturnTo = joinedReturnTo(params);
  const returnTo = explicitReturnTo ?? (typeof defaultReturnTo === "string" ? defaultReturnTo : undefined);

  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title={heading} description={description} breadcrumb={breadcrumb} back={returnTo ? { href: returnTo, label: "listado administrativo" } : undefined} />
    <Card variant="panel">
      <AltaFormFields
        fields={fields}
        submitLabel={submitLabel}
        blocked={blocked}
        filter={filter}
        onSubmit={onSubmit}
        onSuccess={onSuccess ? (message) => onSuccess(message) : (returnTo || defaultReturnTo ? (message, values) => {
          const target = returnTo ?? (typeof defaultReturnTo === "function" ? defaultReturnTo(values) : defaultReturnTo)!;
          router.push(adminCreationHref(target, message, values));
          router.refresh();
        } : undefined)}
      />
    </Card>
  </section>;
}
