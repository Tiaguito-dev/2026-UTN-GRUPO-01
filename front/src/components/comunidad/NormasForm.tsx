"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import type { AsyncState } from "@/hooks/usePaginatedFetch";
import { actualizarNormas, obtenerNormas } from "@/services/comunidad";
import type { NormasConvivencia, NormasInput } from "@/types/comunidad";
import { MAX_TITULO_NORMAS, normalizarNormas, validarNormas } from "@/validations/comunidad";
import { useNormasLeaveGuard } from "./useNormasLeaveGuard";
import styles from "./NormasForm.module.css";

const COMMUNITY = "/home/admin/comunidad";

/** Precarga del documento; el editor no reemplaza su borrador con respuestas posteriores. */
export function NormasForm() {
  const headingId = useId();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ attempt: number; state: AsyncState<NormasConvivencia> } | null>(null);
  useEffect(() => {
    let active = true;
    obtenerNormas().then(
      data => { if (active) setSettled({ attempt, state: { status: "ready", data } }); },
      () => { if (active) setSettled({ attempt, state: { status: "error", error: "No pudimos cargar las normas de convivencia.", notFound: false } }); },
    );
    return () => { active = false; };
  }, [attempt]);
  const state: AsyncState<NormasConvivencia> = settled?.attempt === attempt ? settled.state : { status: "loading" };
  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Administrar normas de convivencia" description="Actualizá el mensaje y las pautas que consulta toda la comunidad."
      back={{ href: COMMUNITY, label: "Comunidad" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Comunidad", href: COMMUNITY }, { label: "Administrar normas" }]} />
    {state.status === "loading" ? <p role="status">Cargando normas de convivencia…</p> : null}
    {state.status === "error" ? <Notice tone="error"><p>{state.error}</p><button className="button button-secondary" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></Notice> : null}
    {state.status === "ready" ? <NormasEditor original={state.data} /> : null}
  </section>;
}

interface NormaRow { id: number; text: string }

export function NormasEditor({ original }: { original: NormasConvivencia }) {
  const prefix = useId();
  const nextRow = useRef(original.normas.length);
  const [titulo, setTitulo] = useState(original.titulo);
  const [introduccion, setIntroduccion] = useState(original.introduccion);
  const [cierre, setCierre] = useState(original.cierre);
  const [rows, setRows] = useState<NormaRow[]>(() => original.normas.map((text, id) => ({ id, text })));
  const input = { titulo, introduccion, normas: rows.map(row => row.text), cierre };
  const dirty = JSON.stringify(input) !== JSON.stringify({ titulo: original.titulo, introduccion: original.introduccion, normas: original.normas, cierre: original.cierre });
  const rowName = (id: number) => `${prefix}-norma-${id}`;
  const rowNames = rows.map(row => rowName(row.id));
  const fields = ["titulo", "introduccion", ...rowNames, "cierre"];
  const { busy, errors, error, handleSubmit, handleChange } = useFormSubmission({
    fields,
    validate: values => {
      const validation = validarNormas({ titulo: values.titulo!, introduccion: values.introduccion!, normas: rowNames.map(name => values[name]!), cierre: values.cierre! });
      const { normas, ...textErrors } = validation;
      return { ...textErrors, ...Object.fromEntries(normas.flatMap((message, index) => message ? [[rowNames[index]!, message]] : [])) };
    },
    fallbackError: "No pudimos guardar las normas de convivencia. Intentá nuevamente.",
    onSubmit: async values => {
      const update: NormasInput = normalizarNormas({ titulo: values.titulo!, introduccion: values.introduccion!, normas: rowNames.map(name => values[name]!), cierre: values.cierre! });
      try { await actualizarNormas(update); }
      catch { throw new Error("No pudimos guardar las normas de convivencia. Intentá nuevamente."); }
      navigation.leaveAfterSave(`${COMMUNITY}?actualizada=1`);
    },
  });
  const navigation = useNormasLeaveGuard(dirty, busy);

  function move(index: number, offset: number) {
    if (busy) return;
    setRows(current => {
      const result = [...current];
      const target = index + offset;
      if (target < 0 || target >= result.length) return current;
      [result[index], result[target]] = [result[target]!, result[index]!];
      return result;
    });
  }

  return <>
    <Card variant="panel"><form onSubmit={handleSubmit} onChange={handleChange} noValidate aria-busy={busy}>
      {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
      <fieldset className={styles.fields} disabled={busy}>
        <legend className="sr-only">Contenido de las normas de convivencia</legend>
        <NormasTextField name="titulo" label="Título" value={titulo} onChange={setTitulo} error={errors.titulo} hint={`Hasta ${MAX_TITULO_NORMAS} caracteres.`} />
        <NormasTextField name="introduccion" label="Mensaje introductorio" value={introduccion} onChange={setIntroduccion} error={errors.introduccion} multiline />
        <div className={styles.normasHeader}><h2 className={styles.subtitle}>Normas de convivencia</h2><p className="hint">Agregá las pautas en el orden en que deben aparecer. Debe quedar al menos una norma.</p></div>
        <ol className={styles.rows}>{rows.map((row, index) => <li key={row.id} className={styles.row}>
          <NormasTextField name={rowName(row.id)} label={`Norma ${index + 1}`} value={row.text} multiline error={errors[rowName(row.id)]}
            onChange={text => setRows(current => current.map(item => item.id === row.id ? { ...item, text } : item))} />
          <div className={styles.rowActions}>
            <button className="button button-secondary" type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir norma ${index + 1}`}>Subir</button>
            <button className="button button-secondary" type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar norma ${index + 1}`}>Bajar</button>
            <button className="button button-secondary" type="button" disabled={rows.length === 1} onClick={() => setRows(current => current.filter(item => item.id !== row.id))} aria-label={`Eliminar norma ${index + 1}`}>Eliminar</button>
          </div>
        </li>)}</ol>
        <button className="button button-secondary" type="button" onClick={() => { const id = nextRow.current++; setRows(current => [...current, { id, text: "" }]); }}>Agregar norma</button>
        <NormasTextField name="cierre" label="Mensaje de cierre" value={cierre} onChange={setCierre} error={errors.cierre} multiline />
        <div className={styles.actions}><button className="button" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => navigation.requestLeave(COMMUNITY)}>Cancelar</button></div>
      </fieldset>
    </form></Card>
    {navigation.pendingLeave ? <Dialog open title="Descartar cambios" description="Tenés cambios sin guardar. Si salís, se perderán." onClose={navigation.cancelLeave} busy={busy}>
      <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={navigation.cancelLeave} data-autofocus>Seguir editando</button><button className="button" type="button" onClick={navigation.confirmLeave}>Descartar y salir</button></div>
    </Dialog> : null}
  </>;
}

function NormasTextField({ name, label, value, onChange, error, hint, multiline = false }: {
  name: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint?: string; multiline?: boolean;
}) {
  const describedBy = [hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className={styles.field}>
    <label htmlFor={name}>{label}</label>
    {multiline ? <textarea className={styles.textarea} id={name} name={name} value={value} required rows={3} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={event => onChange(event.target.value)} />
      : <input id={name} name={name} value={value} required aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={event => onChange(event.target.value)} />}
    {hint ? <p id={`${name}-hint`} className="hint">{hint}</p> : null}
    {error ? <p id={`${name}-error`} className="field-error">{error}</p> : null}
  </div>;
}
