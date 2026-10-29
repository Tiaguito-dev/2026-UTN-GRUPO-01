"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAllPages } from "@/hooks/useAllPages";
import { asignarProfesorComision, quitarProfesorComision, listarProfesores, CARGOS, type CargoDocente, type ProfesorAsignado } from "@/services/academic";
import { MAX_PAGE_SIZE } from "@/services/pagination";
import { cargoLabel } from "@/lib/format/cargo";
import { FormField } from "@/components/ui/FormField";
import { Notice } from "@/components/ui/Notice";
import { iniciales } from "./detalle";
import styles from "./DocentesComision.module.css";
import detailStyles from "./ComisionDetail.module.css";

/** Gestión compartida por el detalle académico y la edición administrativa de comisión. */
export function DocentesComision({ comisionId, profesores: initial, onChange, onBusyChange, disabled = false, separado = false, gestionSolo = false, readOnly = false }: {
  comisionId: string;
  profesores: ProfesorAsignado[];
  onChange?: (profesores: ProfesorAsignado[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  separado?: boolean;
  gestionSolo?: boolean;
  readOnly?: boolean;
}) {
  const id = useId();
  const isAdmin = useIsAdmin();
  const [localProfesores, setProfesores] = useState(initial);
  const profesores = onChange ? initial : localProfesores;
  const [profesorId, setProfesorId] = useState("");
  const [cargo, setCargo] = useState<CargoDocente>("TITULAR");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [asignacionAbierta, setAsignacionAbierta] = useState(true);
  const summaryRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const locked = busy || disabled;
  const canManage = isAdmin && !readOnly;
  const catalogo = useAllPages(canManage ? "profesores" : "", (page) => listarProfesores({ page, pageSize: MAX_PAGE_SIZE }));
  const disponibles = catalogo.state.status === "ready"
    ? catalogo.state.data.filter((p) => !profesores.some((asignado) => asignado.id === p.id)) : [];

  async function guardar(action: () => Promise<ProfesorAsignado[]>, message: string, cerrarAsignacion = false) {
    if (!canManage || pending.current || disabled) return;
    pending.current = true;
    setBusy(true); setError(""); setSuccess("");
    onBusyChange?.(true);
    try {
      const confirmed = await action();
      setProfesores(confirmed);
      onChange?.(confirmed);
      setSuccess(message);
      if (cerrarAsignacion) {
        setAsignacionAbierta(false);
        summaryRef.current?.focus();
      }
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : "No pudimos guardar los docentes. Intentá nuevamente.");
      if (cerrarAsignacion) setAsignacionAbierta(true);
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function cambiarCargo(profesor: ProfesorAsignado, value: string) {
    const next = CARGOS.find((item) => item === value);
    if (!next || next === profesor.cargo) return;
    void guardar(async () => {
      const confirmed = await asignarProfesorComision(comisionId, profesor.id, next);
      return profesores.map((p) => p.id === profesor.id ? confirmed : p);
    }, gestionSolo ? "El cargo se actualizó correctamente." : "Cargo actualizado correctamente.");
  }

  function quitar(profesorId: string) {
    void guardar(async () => {
      await quitarProfesorComision(comisionId, profesorId);
      return profesores.filter((entry) => entry.id !== profesorId);
    }, gestionSolo ? "El profesor se desvinculó correctamente." : "Profesor desvinculado correctamente.");
  }

  function asignar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disponibles.some((p) => p.id === profesorId)) return;
    void guardar(async () => {
      const confirmed = await asignarProfesorComision(comisionId, profesorId, cargo);
      setProfesorId(""); setCargo("TITULAR");
      return [...profesores, confirmed];
    }, gestionSolo ? "El profesor se asignó correctamente." : "Profesor asignado correctamente.", true);
  }

  function controles(profesor: ProfesorAsignado) {
    return <>
      <label htmlFor={`${id}-cargo-${profesor.id}`} className="sr-only">Cambiar cargo de {profesor.nombreCompleto}</label>
      <select id={`${id}-cargo-${profesor.id}`} value={profesor.cargo} disabled={locked} onChange={(event) => cambiarCargo(profesor, event.target.value)}>{CARGOS.map((c) => <option key={c} value={c}>{cargoLabel(c)}</option>)}</select>
      <button className="button button-secondary" type="button" disabled={locked} aria-label={gestionSolo ? `Quitar asignación de ${profesor.nombreCompleto}` : undefined} onClick={() => quitar(profesor.id)}>{gestionSolo ? "Quitar asignación" : "Quitar"}</button>
    </>;
  }

  const feedback = <>
    {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    {success ? <Notice tone="success">{success}</Notice> : null}
    {busy ? <p role="status">Guardando docentes…</p> : null}
  </>;
  const asignacion = canManage ? <details className={gestionSolo ? undefined : "academic-assign"} open={asignacionAbierta} onToggle={(event) => setAsignacionAbierta(event.currentTarget.open)}>
    <summary ref={summaryRef} id={`${id}-asignar`} className={styles.assignmentToggle}>Asignar profesor</summary>
    <form className={gestionSolo ? detailStyles.assignment : undefined} onSubmit={asignar} aria-labelledby={`${id}-asignar`} aria-busy={busy}>
      {catalogo.state.status === "loading" ? <p role="status">Cargando profesores…</p> : null}
      {catalogo.state.status === "error" ? <Notice tone="error">{catalogo.state.error} <button type="button" className="button" onClick={catalogo.retry}>{gestionSolo ? "Reintentar profesores" : "Reintentar"}</button></Notice> : null}
      {catalogo.state.status === "ready" && !disponibles.length ? <p>No hay profesores disponibles para asignar. Podés registrar profesores desde Administración.</p> : null}
      <fieldset className={styles.controls} disabled={locked || catalogo.state.status !== "ready"}>
        <FormField name={`${id}-profesor`} label="Profesor" value={profesorId} onChange={setProfesorId} options={disponibles.map((p) => ({ value: p.id, label: p.nombreCompleto }))} />
        <FormField name={`${id}-cargo`} label="Cargo" value={cargo} onChange={(value) => { const selected = CARGOS.find((item) => item === value); if (selected) setCargo(selected); }} options={CARGOS.map((c) => ({ value: c, label: cargoLabel(c) }))} />
        <button className="button submit" type="submit" disabled={locked || !profesorId || !disponibles.some((p) => p.id === profesorId)}>{busy ? "Guardando…" : "Asignar profesor"}</button>
      </fieldset>
    </form>
  </details> : null;

  if (gestionSolo) return canManage ? <details className={detailStyles.management}>
    <summary>Gestionar equipo docente</summary>
    <div className={detailStyles.managementBody} aria-busy={busy}>
      {feedback}
      {profesores.map((profesor) => <div key={profesor.id} className={detailStyles.adminPerson}><span>{profesor.nombreCompleto}</span>{controles(profesor)}</div>)}
      {asignacion}
    </div>
  </details> : null;

  return <section className={`academic-panel${separado ? ` ${styles.separated}` : ""}`} aria-labelledby={`${id}-profesores`}>
    <div className="academic-panel-header">
      <div><h2 id={`${id}-profesores`}>Profesores</h2><p>Quiénes dictan esta comisión y con qué cargo.</p></div>
    </div>
    <div className="academic-panel-body" aria-busy={busy}>
      {canManage ? <p>Cada asignación, cambio de cargo y desvinculación se guarda inmediatamente, por separado de los datos de la comisión.</p> : null}
      {feedback}
      {profesores.length ? <ul className="row-list">{profesores.map((p) => <li key={p.id} className="academic-person">
        <span className="academic-avatar" aria-hidden="true">{iniciales(p.nombreCompleto)}</span>
        <span className="academic-person-name">{p.nombreCompleto}</span>
        {canManage ? <span className="academic-person-actions">{controles(p)}</span> : <span className="academic-tag">{cargoLabel(p.cargo)}</span>}
      </li>)}</ul> : <p className="academic-empty">No hay profesores asignados a esta comisión.</p>}
      {asignacion}
    </div>
  </section>;
}
