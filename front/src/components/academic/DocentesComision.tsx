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

/** Gestión compartida por el detalle académico y la edición administrativa de comisión. */
export function DocentesComision({ comisionId, profesores: initial, onChange, onBusyChange, disabled = false, separado = false }: {
  comisionId: string;
  profesores: ProfesorAsignado[];
  onChange?: (profesores: ProfesorAsignado[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  separado?: boolean;
}) {
  const id = useId();
  const isAdmin = useIsAdmin();
  const [profesores, setProfesores] = useState(initial);
  const [profesorId, setProfesorId] = useState("");
  const [cargo, setCargo] = useState<CargoDocente>("TITULAR");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [asignacionAbierta, setAsignacionAbierta] = useState(true);
  const summaryRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const locked = busy || disabled;
  const catalogo = useAllPages(isAdmin ? "profesores" : "", (page) => listarProfesores({ page, pageSize: MAX_PAGE_SIZE }));
  const disponibles = catalogo.state.status === "ready"
    ? catalogo.state.data.filter((p) => !profesores.some((asignado) => asignado.id === p.id)) : [];

  async function guardar(action: () => Promise<ProfesorAsignado[]>, message: string, cerrarAsignacion = false) {
    if (!isAdmin || pending.current || disabled) return;
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
    }, "Cargo actualizado correctamente.");
  }

  function asignar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disponibles.some((p) => p.id === profesorId)) return;
    void guardar(async () => {
      const confirmed = await asignarProfesorComision(comisionId, profesorId, cargo);
      setProfesorId(""); setCargo("TITULAR");
      return [...profesores, confirmed];
    }, "Profesor asignado correctamente.", true);
  }

  return <section className={`academic-panel${separado ? ` ${styles.separated}` : ""}`} aria-labelledby={`${id}-profesores`}>
    <div className="academic-panel-header">
      <div><h2 id={`${id}-profesores`}>Profesores</h2><p>Quiénes dictan esta comisión y con qué cargo.</p></div>
    </div>
    <div className="academic-panel-body" aria-busy={busy}>
      {isAdmin ? <p>Cada asignación, cambio de cargo y desvinculación se guarda inmediatamente, por separado de los datos de la comisión.</p> : null}
      {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {busy ? <p role="status">Guardando docentes…</p> : null}
      {profesores.length ? <ul className="row-list">{profesores.map((p) => <li key={p.id} className="academic-person">
        <span className="academic-avatar" aria-hidden="true">{iniciales(p.nombreCompleto)}</span>
        <span className="academic-person-name">{p.nombreCompleto}</span>
        {isAdmin ? <span className="academic-person-actions">
          <label htmlFor={`${id}-cargo-${p.id}`} className="sr-only">Cambiar cargo de {p.nombreCompleto}</label>
          <select id={`${id}-cargo-${p.id}`} value={p.cargo} disabled={locked} onChange={(event) => cambiarCargo(p, event.target.value)}>{CARGOS.map((c) => <option key={c} value={c}>{cargoLabel(c)}</option>)}</select>
          <button className="button button-secondary" type="button" disabled={locked} onClick={() => { void guardar(async () => { await quitarProfesorComision(comisionId, p.id); return profesores.filter((entry) => entry.id !== p.id); }, "Profesor desvinculado correctamente."); }}>Quitar</button>
        </span> : <span className="academic-tag">{cargoLabel(p.cargo)}</span>}
      </li>)}</ul> : <p className="academic-empty">No hay profesores asignados a esta comisión.</p>}
      {isAdmin ? <details className="academic-assign" open={asignacionAbierta} onToggle={(event) => setAsignacionAbierta(event.currentTarget.open)}>
        <summary ref={summaryRef} id={`${id}-asignar`} className={styles.assignmentToggle}>Asignar profesor</summary>
        <form onSubmit={asignar} aria-labelledby={`${id}-asignar`} aria-busy={busy}>
          {catalogo.state.status === "loading" ? <p role="status">Cargando profesores…</p> : null}
          {catalogo.state.status === "error" ? <Notice tone="error">{catalogo.state.error} <button type="button" className="button" onClick={catalogo.retry}>Reintentar</button></Notice> : null}
          {catalogo.state.status === "ready" && !disponibles.length ? <p>No hay profesores disponibles para asignar. Podés registrar profesores desde Administración.</p> : null}
          <fieldset className={styles.controls} disabled={locked || catalogo.state.status !== "ready"}>
            <FormField name={`${id}-profesor`} label="Profesor" value={profesorId} onChange={setProfesorId} options={disponibles.map((p) => ({ value: p.id, label: p.nombreCompleto }))} />
            <FormField name={`${id}-cargo`} label="Cargo" value={cargo} onChange={(value) => { const selected = CARGOS.find((item) => item === value); if (selected) setCargo(selected); }} options={CARGOS.map((c) => ({ value: c, label: cargoLabel(c) }))} />
            <button className="button submit" type="submit" disabled={locked || !profesorId || !disponibles.some((p) => p.id === profesorId)}>{busy ? "Guardando…" : "Asignar profesor"}</button>
          </fieldset>
          </form>
      </details> : null}
    </div>
  </section>;
}
